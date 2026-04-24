#!/usr/bin/env python3
"""
Async SOCKS5 proxy — non-blocking, single-file, stdlib-only.
Works with Telegram (Settings → Advanced → Connection type → SOCKS5).

Run:
    python3 socks5.py                                  # 0.0.0.0:1080, no auth
    python3 socks5.py --host 0.0.0.0 --port 1080
    python3 socks5.py --user alice --password s3cret   # username/password auth
    python3 socks5.py --ipv4-only                      # force IPv4 upstream

Telegram client setup:
    Settings → Advanced → Connection type → Use custom proxy → Add proxy
    Type: SOCKS5    Server: <your-server-ip>    Port: 1080
    (optional) Username / Password

Why non-blocking:
    Built on asyncio — one event loop handles thousands of concurrent
    connections without threads. Each client runs as two coroutines
    (client→remote, remote→client) piping bytes via StreamReader/Writer.
"""

import argparse
import asyncio
import ipaddress
import logging
import socket
import struct
import sys

SOCKS_VERSION = 0x05

# Auth methods
AUTH_NONE = 0x00
AUTH_USERPASS = 0x02
AUTH_NO_ACCEPTABLE = 0xFF

# Commands
CMD_CONNECT = 0x01
CMD_BIND = 0x02
CMD_UDP_ASSOCIATE = 0x03

# Address types
ATYP_IPV4 = 0x01
ATYP_DOMAIN = 0x03
ATYP_IPV6 = 0x04

# Reply codes (RFC 1928)
REP_SUCCESS = 0x00
REP_GENERAL_FAILURE = 0x01
REP_NOT_ALLOWED = 0x02
REP_NETWORK_UNREACHABLE = 0x03
REP_HOST_UNREACHABLE = 0x04
REP_CONNECTION_REFUSED = 0x05
REP_TTL_EXPIRED = 0x06
REP_COMMAND_NOT_SUPPORTED = 0x07
REP_ADDRESS_NOT_SUPPORTED = 0x08

BUF_SIZE = 64 * 1024
CONNECT_TIMEOUT = 15
HANDSHAKE_TIMEOUT = 30

log = logging.getLogger("socks5")


class ProtocolError(Exception):
    pass


async def read_exact(reader: asyncio.StreamReader, n: int) -> bytes:
    data = await reader.readexactly(n)
    return data


def errno_to_rep(exc: BaseException) -> int:
    if isinstance(exc, ConnectionRefusedError):
        return REP_CONNECTION_REFUSED
    if isinstance(exc, socket.gaierror):
        return REP_HOST_UNREACHABLE
    if isinstance(exc, (TimeoutError, asyncio.TimeoutError)):
        return REP_TTL_EXPIRED
    if isinstance(exc, OSError):
        return REP_NETWORK_UNREACHABLE
    return REP_GENERAL_FAILURE


class Socks5Server:
    def __init__(self, host, port, username=None, password=None, ipv4_only=False):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.auth_required = bool(username)
        self.ipv4_only = ipv4_only

    async def start(self):
        server = await asyncio.start_server(
            self.handle_client, self.host, self.port, reuse_address=True
        )
        addrs = ", ".join(str(s.getsockname()) for s in server.sockets)
        auth = "user/pass" if self.auth_required else "no-auth"
        log.info("SOCKS5 listening on %s (%s)", addrs, auth)
        async with server:
            await server.serve_forever()

    async def handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        peer = writer.get_extra_info("peername")
        remote_writer = None
        try:
            await asyncio.wait_for(self._negotiate_auth(reader, writer), HANDSHAKE_TIMEOUT)
            remote_reader, remote_writer = await asyncio.wait_for(
                self._handle_request(reader, writer), HANDSHAKE_TIMEOUT
            )
            await self._relay(reader, writer, remote_reader, remote_writer)
        except asyncio.IncompleteReadError:
            pass
        except ProtocolError as e:
            log.info("protocol error from %s: %s", peer, e)
        except (asyncio.TimeoutError, TimeoutError):
            log.info("timeout for %s", peer)
        except ConnectionResetError:
            pass
        except Exception as e:
            log.exception("unexpected error for %s: %s", peer, e)
        finally:
            close_writer(writer)
            if remote_writer is not None:
                close_writer(remote_writer)

    async def _negotiate_auth(self, reader, writer):
        header = await read_exact(reader, 2)
        ver, nmethods = header[0], header[1]
        if ver != SOCKS_VERSION:
            raise ProtocolError(f"bad SOCKS version {ver}")
        methods = await read_exact(reader, nmethods)

        chosen = AUTH_NO_ACCEPTABLE
        if self.auth_required:
            if AUTH_USERPASS in methods:
                chosen = AUTH_USERPASS
        else:
            if AUTH_NONE in methods:
                chosen = AUTH_NONE

        writer.write(bytes([SOCKS_VERSION, chosen]))
        await writer.drain()

        if chosen == AUTH_NO_ACCEPTABLE:
            raise ProtocolError("no acceptable auth methods")

        if chosen == AUTH_USERPASS:
            await self._userpass_auth(reader, writer)

    async def _userpass_auth(self, reader, writer):
        # RFC 1929
        ver = (await read_exact(reader, 1))[0]
        if ver != 0x01:
            raise ProtocolError(f"bad userpass version {ver}")
        ulen = (await read_exact(reader, 1))[0]
        uname = await read_exact(reader, ulen)
        plen = (await read_exact(reader, 1))[0]
        passwd = await read_exact(reader, plen)

        ok = (
            uname.decode("utf-8", "replace") == self.username
            and passwd.decode("utf-8", "replace") == self.password
        )
        writer.write(bytes([0x01, 0x00 if ok else 0x01]))
        await writer.drain()
        if not ok:
            raise ProtocolError("auth failed")

    async def _handle_request(self, reader, writer):
        header = await read_exact(reader, 4)
        ver, cmd, _rsv, atyp = header
        if ver != SOCKS_VERSION:
            raise ProtocolError(f"bad SOCKS version {ver}")

        if atyp == ATYP_IPV4:
            ip_bytes = await read_exact(reader, 4)
            dst_host = socket.inet_ntop(socket.AF_INET, ip_bytes)
        elif atyp == ATYP_IPV6:
            ip_bytes = await read_exact(reader, 16)
            dst_host = socket.inet_ntop(socket.AF_INET6, ip_bytes)
        elif atyp == ATYP_DOMAIN:
            dlen = (await read_exact(reader, 1))[0]
            dst_host = (await read_exact(reader, dlen)).decode("idna")
        else:
            await self._reply(writer, REP_ADDRESS_NOT_SUPPORTED)
            raise ProtocolError(f"unsupported atyp {atyp}")

        dst_port = struct.unpack("!H", await read_exact(reader, 2))[0]

        if cmd != CMD_CONNECT:
            await self._reply(writer, REP_COMMAND_NOT_SUPPORTED)
            raise ProtocolError(f"unsupported cmd {cmd}")

        family = socket.AF_INET if self.ipv4_only else socket.AF_UNSPEC
        try:
            remote_reader, remote_writer = await asyncio.wait_for(
                asyncio.open_connection(dst_host, dst_port, family=family),
                CONNECT_TIMEOUT,
            )
        except Exception as e:
            rep = errno_to_rep(e)
            log.info("connect %s:%d failed: %s", dst_host, dst_port, e)
            await self._reply(writer, rep)
            raise ProtocolError(f"connect failed: {e}")

        bnd = remote_writer.get_extra_info("sockname") or ("0.0.0.0", 0)
        await self._reply(writer, REP_SUCCESS, bnd[0], bnd[1])
        log.info("open %s:%d → %s", dst_host, dst_port, bnd)
        return remote_reader, remote_writer

    async def _reply(self, writer, rep, bnd_host="0.0.0.0", bnd_port=0):
        try:
            ip = ipaddress.ip_address(bnd_host)
            if isinstance(ip, ipaddress.IPv6Address):
                atyp = ATYP_IPV6
                addr_bytes = ip.packed
            else:
                atyp = ATYP_IPV4
                addr_bytes = ip.packed
        except ValueError:
            atyp = ATYP_IPV4
            addr_bytes = b"\x00\x00\x00\x00"
        writer.write(
            bytes([SOCKS_VERSION, rep, 0x00, atyp])
            + addr_bytes
            + struct.pack("!H", bnd_port)
        )
        try:
            await writer.drain()
        except ConnectionError:
            pass

    async def _relay(self, cr, cw, rr, rw):
        async def pipe(src, dst, tag):
            try:
                while True:
                    chunk = await src.read(BUF_SIZE)
                    if not chunk:
                        break
                    dst.write(chunk)
                    await dst.drain()
            except (ConnectionResetError, BrokenPipeError):
                pass
            finally:
                try:
                    if dst.can_write_eof():
                        dst.write_eof()
                except (OSError, RuntimeError):
                    pass

        await asyncio.gather(
            pipe(cr, rw, "c→r"),
            pipe(rr, cw, "r→c"),
            return_exceptions=True,
        )


def close_writer(writer: asyncio.StreamWriter):
    try:
        writer.close()
    except Exception:
        pass


def parse_args(argv):
    p = argparse.ArgumentParser(description="Async SOCKS5 proxy (Telegram-friendly)")
    p.add_argument("--host", default="0.0.0.0", help="listen address (default 0.0.0.0)")
    p.add_argument("--port", type=int, default=1080, help="listen port (default 1080)")
    p.add_argument("--user", default=None, help="username (enables userpass auth)")
    p.add_argument("--password", default=None, help="password (required with --user)")
    p.add_argument("--ipv4-only", action="store_true", help="force IPv4 for upstream DNS")
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args(argv)
    if (args.user and not args.password) or (args.password and not args.user):
        p.error("--user and --password must be used together")
    return args


async def main_async(args):
    server = Socks5Server(
        args.host, args.port,
        username=args.user, password=args.password,
        ipv4_only=args.ipv4_only,
    )
    await server.start()


def main():
    args = parse_args(sys.argv[1:])
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    try:
        asyncio.run(main_async(args))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

/* BearMP — мультиплеер через MQTT (публичный broker.emqx.io).
   Работает из любой страны, без регистрации, без ключей. */
(function () {
  const BROKER = 'wss://broker.emqx.io:8084/mqtt';

  const BearMP = {
    client: null,
    code: null,
    role: null, // 'host' или 'guest'
    topic: null,
    onMessage: null,
    onStatus: null, // колбэк для смены статуса: 'online' | 'offline' | 'reconnecting'
    connected: false,

    generateCode() {
      const bytes = new Uint32Array(1);
      if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(bytes);
        return String(100000 + (bytes[0] % 900000));
      }
      return String(Math.floor(100000 + Math.random() * 900000));
    },

    connect(code, role, onMessage, onStatus) {
      const normalizedCode = String(code || '').replace(/\D/g, '').slice(0, 6);
      if (normalizedCode.length !== 6) {
        return Promise.reject(new Error('Введи 6 цифр кода комнаты'));
      }

      this.code = normalizedCode;
      this.role = role;
      this.onMessage = onMessage;
      this.onStatus = onStatus || null;
      this.topic = 'bear-game-2026/v2/' + normalizedCode;
      this.connected = false;

      return new Promise((resolve, reject) => {
        const clientId = 'bear_' + role + '_' + Math.random().toString(36).slice(2, 10);

        try {
          this.client = mqtt.connect(BROKER, {
            clientId: clientId,
            clean: true,
            connectTimeout: 8000,
            reconnectPeriod: 3000,
            keepalive: 30,
          });
        } catch (e) {
          reject(new Error('Не удалось подключиться к серверу'));
          return;
        }

        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) { resolved = true; reject(new Error('Сервер не отвечает. Проверь интернет.')); }
        }, 10000);

        // Каждый reconnect — новая сессия на брокере (clean:true),
        // поэтому подписываемся заново при каждом 'connect'.
        this.client.on('connect', () => {
          clearTimeout(timeout);
          this.client.subscribe(this.topic, { qos: 1 }, (err) => {
            if (err) {
              if (!resolved) { resolved = true; reject(new Error('Не удалось подписаться на канал')); }
              return;
            }
            this.connected = true;
            if (this.onStatus) { try { this.onStatus('online'); } catch(e){} }
            if (!resolved) { resolved = true; resolve(); }
          });
        });

        this.client.on('reconnect', () => {
          if (this.onStatus) { try { this.onStatus('reconnecting'); } catch(e){} }
        });

        this.client.on('offline', () => {
          this.connected = false;
          if (this.onStatus) { try { this.onStatus('offline'); } catch(e){} }
        });

        this.client.on('close', () => {
          this.connected = false;
        });

        this.client.on('error', (err) => {
          clearTimeout(timeout);
          if (!resolved) { resolved = true; reject(new Error('Ошибка связи: ' + (err.message || 'неизвестная'))); }
        });

        this.client.on('message', (topic, payload) => {
          try {
            const msg = JSON.parse(payload.toString());
            if (msg._room !== this.code) return;
            // Игнорируем свои сообщения (эхо от брокера)
            if (msg._from === this.role) return;
            if (this.onMessage) this.onMessage(msg);
          } catch (e) { /* плохой JSON — игнорируем */ }
        });
      });
    },

    send(data) {
      if (!this.client || !this.connected) return;
      data._room = this.code;
      data._from = this.role;
      const payload = JSON.stringify(data);
      const client = this.client;
      const topic = this.topic;
      // queueMicrotask — publish нельзя синхронно изнутри on('message') callback.
      // Микротаск гарантирует порядок и выполняется сразу после текущего стека.
      const publish = () => {
        try { client.publish(topic, payload, { qos: 1 }); } catch(e) {}
      };
      if (typeof queueMicrotask === 'function') queueMicrotask(publish);
      else Promise.resolve().then(publish);
    },

    disconnect() {
      if (this.client) {
        try { this.client.end(true); } catch (e) {}
      }
      this.client = null;
      this.connected = false;
      this.onStatus = null;
    },
  };

  window.BearMP = BearMP;
})();

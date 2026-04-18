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
    connected: false,

    generateCode() {
      return String(Math.floor(1000 + Math.random() * 9000));
    },

    connect(code, role, onMessage) {
      this.code = code;
      this.role = role;
      this.onMessage = onMessage;
      this.topic = 'bear-game-2026/' + code;
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

        const timeout = setTimeout(() => {
          reject(new Error('Сервер не отвечает. Проверь интернет.'));
        }, 10000);

        this.client.on('connect', () => {
          clearTimeout(timeout);
          this.client.subscribe(this.topic, { qos: 1 }, (err) => {
            if (err) {
              reject(new Error('Не удалось подписаться на канал'));
            } else {
              this.connected = true;
              resolve();
            }
          });
        });

        this.client.on('error', (err) => {
          clearTimeout(timeout);
          reject(new Error('Ошибка связи: ' + (err.message || 'неизвестная')));
        });

        this.client.on('message', (topic, payload) => {
          try {
            const msg = JSON.parse(payload.toString());
            // Игнорируем свои сообщения
            if (msg._from === this.role) return;
            if (this.onMessage) this.onMessage(msg);
          } catch (e) { /* плохой JSON — игнорируем */ }
        });
      });
    },

    send(data) {
      if (!this.client || !this.connected) return;
      data._from = this.role;
      this.client.publish(this.topic, JSON.stringify(data), { qos: 1 });
    },

    disconnect() {
      if (this.client) {
        try { this.client.end(true); } catch (e) {}
      }
      this.client = null;
      this.connected = false;
    },
  };

  window.BearMP = BearMP;
})();

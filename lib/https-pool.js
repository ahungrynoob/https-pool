'use strict';

const https = require('https');
const forge = require('node-forge');
const detect = require('detect-port');
const { createCertificate, createCACert, defer } = require('./utils');

const pki = forge.pki;
const LOCALHOST = '127.0.0.1';

class HttpsPool {
  /**
   * https pool to get certificated https server
   * @param {Object} option - option for https pool
   * @param {number} option.timeout - https server won't close until secure conntection is established within timeout
   * @default 6000
   * @param {number} option.max_servers - max num for https servers the pool cached
   * @default 220
   * the subect and issuer options for the root ca
   * @param {string} option.key - the private key for the root ca in pem format
   * @param {string} option.commonName - the common name option
   * @param {string} option.countryName - the country name option
   * @param {string} option.ST - the ST option
   * @param {string} option.localityName - the locality name option
   * @param {string} option.organizationName - the organization name option
   * @param {string} option.OU - the OU option
   */
  constructor({
    timeout,
    max_servers,
    key,
    commonName,
    countryName,
    ST,
    localityName,
    organizationName,
    OU,
  }) {
    this._cache = {};
    this.TIMEOUT = timeout || 6000;
    this.MAX_SERVERS = max_servers || 220;
    this._rawCA = createCACert({
      key,
      commonName,
      countryName,
      ST,
      localityName,
      organizationName,
      OU,
    });
    this.CA = {
      key: pki.privateKeyToPem(this._rawCA.key),
      cert: pki.certificateToPem(this._rawCA.cert),
    };
  }

  /**
   * it will return a https server if available or will create one with cert
   * @param {string} hostname - hostname which https server base on
   * @param {Function | Object} listener - request event listener or Object type with custom event listener
   * @param {Function} callback - callback func with port arg
   * @param {number} timeout - timeout for https server in ms
   */
  getServer(hostname, listener, callback, timeout) {
    if (this._cache[hostname]) {
      this._cache[hostname].then(callback);
      return;
    }

    const { promise, resolve } = defer();
    this._cache[hostname] = promise;
    this._cache[hostname].then(callback);

    this.free();

    // start create server
    const option = createCertificate(hostname, this._rawCA.key, this._rawCA.cert);
    option.key = pki.privateKeyToPem(option.key);
    option.cert = pki.certificateToPem(option.cert);

    const server = https.createServer(option);

    if (typeof listener === 'function') {
      server.on('request', listener);
    } else if (listener) {
      for (const event in listener) {
        server.on(event, listener[event]);
      }
    }

    if (/^\d+$/.test(timeout)) {
      server.timeout = timeout;
    }

    // error handle
    server.on('error', () => this.removeServer(hostname));
    server.once('tlsClientError', () => {
      this.removeServer(hostname);
    });

    detect().then(port => {
      server.listen(port, LOCALHOST, () => {
        const timer = setTimeout(() => this.removeServer(hostname), this.TIMEOUT);
        server.once('secureConnection', function() {
          clearTimeout(timer);
        });
        promise.server = server;
        resolve(port);
      });
    }).catch(
      /* istanbul ignore next */
      () => {}
    );
  }

  /**
   * whether the server basing on the hostname exists
   * @param {string} hostname - the hostname server base on
   * @return {boolean} -
   */
  existsServer(hostname) {
    const promise = this._cache[hostname];
    if (promise) {
      return true;
    }
    return false;
  }

  /**
   * remove the server in the cache
   * @param {string} hostname - the hostname server base on
   */
  removeServer(hostname) {
    const promise = this._cache[hostname];
    if (!promise) {
      return;
    }
    delete this._cache[hostname];

    try {
      promise.server && promise.server.close();
    } catch (e) {
      // placeholder
    }
  }

  /**
   * free the https server without connections when count > max
   */
  free() {
    /*
    * TODO: use lock in the future, We use Object.keys() now for multi process.
    * [o(n) complexity]
    */
    const server_count = Object.keys(this._cache).length;
    if (server_count < this.MAX_SERVERS) {
      return;
    }
    for (const hostname in this._cache) {
      const promise = this._cache[hostname];
      const server = promise.server;
      if (promise && server && !promise._pending) {
        promise._pending = true;
        server.getConnections((err, count) => {
          promise._pending = false;
          if (!err && !count && server_count >= this.MAX_SERVERS) {
            this.removeServer(hostname);
          }
        });
      }
    }
  }

  /**
   * clear the https pool forcily
   */
  clear() {
    for (const hostname in this._cache) {
      this.removeServer(hostname);
    }
    this._cache = {};
  }
}

module.exports = HttpsPool;

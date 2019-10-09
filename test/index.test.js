'use strict';

const assert = require('assert');
const mm = require('mm');
const net = require('net');
const request = require('request');
const HttpsPool = require('../index');

describe('lib/https-pool.js', () => {
  let httpsPool;
  beforeEach(() => {
    httpsPool = new HttpsPool({
      commonName: 'example',
      countryName: 'CN',
      ST: 'SH',
      localityName: 'SH',
      organizationName: 'example.com',
      OU: 'example.com',
    });
  });

  afterEach(() => {
    httpsPool.clear();
  });

  describe('httpsPool#constructor', () => {
    it('should return a https pool instance and get default options', () => {
      assert(httpsPool.TIMEOUT === 6000);
      assert(httpsPool.MAX_SERVERS === 220);
      assert(typeof httpsPool.CA.cert === 'string' && typeof httpsPool.CA.key === 'string');
    });
  });

  describe('httpsPool#getServer', () => {
    it('should get cached https server', done => {
      httpsPool.getServer('www.foo.com');
      httpsPool.getServer('www.foo.com', null, port => {
        assert(typeof port === 'number');
        done();
      });
    });

    it('should emit request event when listener is function', done => {
      let port;
      httpsPool.getServer('www.foo.com', req => {
        assert.strictEqual(req.headers.host, '127.0.0.1:' + port);
        done();
      }, _port => {
        port = _port;
        request.get({
          url: 'https://127.0.0.1:' + port,
          rejectUnauthorized: false,
        });
      });
    });

    it('should emit request event when listener is object', done => {
      let port;
      httpsPool.getServer('www.foo.com', {
        request: req => {
          assert.strictEqual(req.headers.host, '127.0.0.1:' + port);
          done();
        },
      }, _port => {
        port = _port;
        request.get({
          url: 'https://127.0.0.1:' + port,
          rejectUnauthorized: false,
        });
      });
    });

    it('should remove server when emit error', done => {
      httpsPool.getServer('www.foo.com', null, () => {
        httpsPool._cache['www.foo.com'].server.emit('error');
        assert(httpsPool._cache['www.foo.com'] === undefined);
        done();
      });
    });

    it('should remove server when emit tlsClientError', done => {
      httpsPool.getServer('www.foo.com', null, () => {
        const mockConn = { destroy: () => {} };
        httpsPool._cache['www.foo.com'].server.emit('tlsClientError', new Error('mock err'), mockConn);
        assert(httpsPool._cache['www.foo.com'] === undefined);
        done();
      });
    });

    it('should remove server when no connection happens with timeout', done => {
      httpsPool = new HttpsPool({
        timeout: 1000,
        commonName: 'example',
        countryName: 'CN',
        ST: 'SH',
        localityName: 'SH',
        organizationName: 'example.com',
        OU: 'example.com',
      });

      httpsPool.getServer('www.foo.com');
      setTimeout(() => {
        assert(httpsPool._cache['www.foo.com'] === undefined);
        done();
      }, 1500);
    });
  });

  describe('httpsPool#existsServer', () => {
    it('should return true when pool has server', done => {
      httpsPool.getServer('www.foo.com', null, () => {
        assert.strictEqual(httpsPool.existsServer('www.foo.com'), true);
        done();
      });
    });

    it('should return false when pool has no such server', done => {
      httpsPool.getServer('www.foo.com', null, () => {
        assert.strictEqual(httpsPool.existsServer('www.example.com'), false);
        done();
      });
    });
  });

  describe('httpsPool#removeServer', () => {
    it('should return undefined after remove server', done => {
      httpsPool.getServer('www.foo.com', null, () => {
        httpsPool.removeServer('www.foo.com');
        assert(httpsPool._cache['www.foo.com'] === undefined);
        done();
      }, 10000);
    });

    it('should return undefined after remove inexistent server', () => {
      httpsPool.removeServer('www.foo.com');
      assert(httpsPool._cache['www.foo.com'] === undefined);
    });
  });

  describe('httpsPool#free', () => {
    it('should get correct server count', done => {
      httpsPool = new HttpsPool({
        max_servers: 2,
        commonName: 'example',
        countryName: 'CN',
        ST: 'SH',
        localityName: 'SH',
        organizationName: 'example.com',
        OU: 'example.com',
      });
      assert(httpsPool.MAX_SERVERS === 2);
      httpsPool.getServer('www.foo.com', null, () => {
        httpsPool.getServer('www.bar.com', null, () => {
          httpsPool.free();
          const serverCount = Object.keys(httpsPool._cache).length;
          assert(serverCount === 1);
          done();
        });
      });
    });

    it('should get correct server count when secure connection established', done => {
      httpsPool = new HttpsPool({
        max_servers: 2,
        commonName: 'example',
        countryName: 'CN',
        ST: 'SH',
        localityName: 'SH',
        organizationName: 'example.com',
        OU: 'example.com',
      });
      mm(net.Server.prototype, 'getConnections', function(cb) {
        return cb(null, 1);
      });

      httpsPool.getServer('www.foo.com', null, () => {
        httpsPool.getServer('www.bar.com', null, () => {
          httpsPool.free();
          const serverCount = Object.keys(httpsPool._cache).length;
          assert(serverCount === 2);
          done();
        });
      });
    });
  });

  describe('httpsPool#clear', () => {
    it('should return empty cache after clear', () => {
      httpsPool.clear();
      assert.deepEqual(httpsPool._cache, {});
    });
  });
});

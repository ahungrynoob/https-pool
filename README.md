# https-pool

A cached pool of https server for domains.

---

[![NPM version](https://img.shields.io/npm/v/https-pool.svg?style=flat)](https://npmjs.org/package/https-pool)
[![Build Status](https://img.shields.io/travis/ahungrynoob/https-pool.svg?style=flat)](https://travis-ci.org/ahungrynoob/https-pool)
[![codecov.io](https://img.shields.io/codecov/c/github/ahungrynoob/https-pool.svg?style=flat)](http://codecov.io/github/ahungrynoob/https-pool?branch=master)
[![NPM downloads](http://img.shields.io/npm/dm/https-pool.svg?style=flat)](https://npmjs.org/package/https-pool)

## Install

```bash
$ npm i https-pool --save
```

## Usage

> https-pool is useful for getting https server without worry about forging certificates.

Just pass your CA certificate options into HttpsPool, and get a empty https server pool.

```javascript
const HttpsPool = require("https-pool");
const fs = require("fs");

const key = fs.readFileSync(path.join(fixtures, "root.key"));
const cert = fs.readFileSync(path.join(fixtures, "root.crt"));

const httpsPool = new HttpsPool({
  key,
  cert,
  commonName: "example",
  countryName: "CN",
  ST: "SH",
  localityName: "SH",
  organizationName: "example.com",
  OU: "example.com"
});

// You can save the cert and key of root CA to let the client trust it.
const { key, cert } = httpsPool.CA;
```

You can get a https server like this ↓. That's enough for common usage. `https-pool` will take care of the cache logic, so worrying about your memory is unnecessary.

```javascript
httpsPool.getServer(
  "www.foo.com",
  (req, res) => {
    // the listener for server.request event
    console.log(req.headers);
    res.send("ok");
  },
  _port => {
    // callback with a random available port
    console.log(typeof _port === "number");
  },
  // timeout for the new https-server
  3000
);
```

## API

### Properties

- `httpsPool.CA` - return as {key, cert} in the format as pem. (You could trust the key and cert on the your client such as browser)

### HttpsPool(options)

It will create a https pool.

- options
  - `option.timeout` - https server won't close until secure conntection is established within timeout (default 6000)
  - `option.max_servers` - max num for https servers the pool cached (default 220)
  - `option.key` and `option.cert`- the private key and cert of the root ca which your client trusts or https-pool will create one
  - If you don't pass `option.key` and `option.cert`, you need to pass these options:
    - `option.commonName` - the common name option
    - `option.countryName` - the country name option
    - `option.ST` - the ST option
    - `option.localityName` - the locality name option
    - `option.organizationName` - the organization name option
    - `option.OU` - the OU option

### HttpsPool#getServer(hostname, listener, callback, timeout)

It will return a https server if available or will create one and cached.

- `hostname` - hostname which https server base on
- `listener` {`Function` | `Object`} - request event listener or Object type with custom event listener
- `callback` - callback func with port arg
- `timeout` - timeout for https server in ms

### HttpsPool#existsServer(hostname)

Tell whether the server basing on the hostname exists

- `hostname` - the hostname server base on
- `return {boolean}`

### HttpsPool#removeServer(hostname)

Remove the server in the cache

- `hostname` - the hostname server base on

### HttpsPool#free()

Free the https server who has no connections when count > max

### HttpsPool#clear()

Clear the https pool forcily

## LICENSE

Licensed under the MIT license.

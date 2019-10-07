'use strict';

const mm = require('mm');
const path = require('path');
const forge = require('node-forge');
const fs = require('fs');
const assert = require('assert');
const { createCACert, createCertificate } = require('../../lib/utils');

const pki = forge.pki;

const fixtures = path.join(__dirname, '../fixtures');

// const certificate = createCertificate('www.taobao.com', ca.key, ca.cert);

describe('lib/utils', () => {
  afterEach(mm.restore);
  it('should generate correct root ca pem', () => {
    mm(forge.pki.rsa, 'generateKeyPair', function() {
      const privateKeyPem = fs.readFileSync(path.join(fixtures, 'root.key'));
      const privateKey = pki.privateKeyFromPem(privateKeyPem);
      const publicKey = pki.setRsaPublicKey(privateKey.n, privateKey.e);
      return { privateKey, publicKey };
    });

    const RealDate = Date;

    mm(global, 'Date', class extends RealDate {
      constructor() {
        return new RealDate(2019, 5, 5, 15, 46);
      }

      getFullYear() {
        return 2019;
      }
    });

    const ca = createCACert({
      commonName: 'whistle.1559742360747607',
      countryName: 'CN',
      ST: 'ZJ',
      localityName: 'HZ',
      organizationName: '1559742360747607.wproxy.org',
      OU: 'wproxy.org',
    });

    const caPem = pki.certificateToPem(ca.cert);
    const rootCrt = fs.readFileSync(path.join(fixtures, 'root.crt'), 'utf8');
    fs.writeFileSync(path.join(fixtures, 'test.crt'), caPem);
    assert.equal(caPem.replace(/[\r\n]/g, ''), rootCrt.replace(/[\r\n]/g, ''));
  });

  it('should generate correct certificate based on hostname', () => {
    const privateKeyPem = fs.readFileSync(path.join(fixtures, 'root.key'));
    const privateKey = pki.privateKeyFromPem(privateKeyPem);
    const certPem = fs.readFileSync(path.join(fixtures, 'root.crt'));
    const cert = pki.certificateFromPem(certPem);

    const certificateDomain = createCertificate('www.taobao.com', privateKey, cert);
    assert.equal(
      pki.certificateFromPem(certificateDomain.cert).subject.attributes[0].value,
      'www.taobao.com'
    );

    const certificateIP = createCertificate('192.168.1.1', privateKey, cert);
    assert.equal(
      pki.certificateFromPem(certificateIP.cert).subject.attributes[0].value,
      '192.168.1.1'
    );
  });
});

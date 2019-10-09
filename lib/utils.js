'use strict';

const forge = require('node-forge');
const crypto = require('crypto');
const net = require('net');

const pki = forge.pki;

/**
 * create certificate
 * @param {pki.rsa.PublicKey} publicKey - the public key for a cert
 * @param {string} serialNumber - serial number for a cert
 * @default '01'
 */
function createCert(publicKey, serialNumber = '01') {
  const cert = pki.createCertificate();
  cert.publicKey = publicKey;
  cert.serialNumber = serialNumber;
  const curYear = new Date().getFullYear();
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notBefore.setFullYear(curYear - 1);
  cert.validity.notAfter.setFullYear(curYear + 10);
  return cert;
}

/**
 * create a root CA cert with privateKey pem or will use own privateKey
 *
 * @param {Object} option - the subect and issuer options for the root ca
 * @param {string} option.key - the private key for CA
 * @param {string} option.commonName - the common name option
 * @param {string} option.countryName - the country name option
 * @param {string} option.ST - the ST option
 * @param {string} option.localityName - the locality name option
 * @param {string} option.organizationName - the organization name option
 * @param {string} option.OU - the OU option
 * @return {Object} - return private key and cert
 */
function createCACert(option) {
  const { commonName, countryName, ST, localityName, organizationName, OU, key } = option;
  let privateKey;
  let publicKey;
  if (option.key) {
    privateKey = pki.privateKeyFromPem(key);
    publicKey = pki.setRsaPublicKey(privateKey.n, privateKey.e);
  } else {
    const keyPair = pki.rsa.generateKeyPair(2048);
    privateKey = keyPair.privateKey;
    publicKey = keyPair.publicKey;
  }
  const cert = createCert(publicKey);
  const attrs = [{
    name: 'commonName',
    value: commonName,
  }, {
    name: 'countryName',
    value: countryName,
  }, {
    shortName: 'ST',
    value: ST,
  }, {
    name: 'localityName',
    value: localityName,
  }, {
    name: 'organizationName',
    value: organizationName,
  }, {
    shortName: 'OU',
    value: OU,
  }];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([{
    name: 'basicConstraints',
    cA: true,
  }, {
    name: 'keyUsage',
    keyCertSign: true,
    digitalSignature: true,
    nonRepudiation: true,
    keyEncipherment: true,
    dataEncipherment: true,
  }, {
    name: 'extKeyUsage',
    serverAuth: true,
    clientAuth: true,
    codeSigning: true,
    emailProtection: true,
    timeStamping: true,
  }, {
    name: 'nsCertType',
    client: true,
    server: true,
    email: true,
    objsign: true,
    sslCA: true,
    emailCA: true,
    objCA: true,
  }]);

  cert.sign(privateKey, forge.md.sha256.create());

  return {
    key: privateKey,
    cert,
  };
}

/**
 * create certificate for a specific hostname
 * @param {string} hostname - the hostname which certificate based on
 * @param {pki.rsa.PrivateKey} privateKey - your private key of the root ca
 * @param {pki.Certificate} ca - the root ca
 * @return {Object} - return the private key and cert in pem format
 */
function createCertificate(hostname, privateKey, ca) {
  const RANDOM_SERIAL = '.' + Date.now() + '.' + Math.floor(Math.random() * 10000);
  const serialNumber = crypto.createHash('sha1')
    .update(hostname + RANDOM_SERIAL, 'binary').digest('hex');
  const cert = createCert(ca.publicKey, serialNumber);

  cert.setSubject([{
    name: 'commonName',
    value: hostname,
  }]);

  cert.setIssuer(ca.subject.attributes);
  cert.setExtensions([{
    name: 'subjectAltName',
    altNames: [ net.isIP(hostname) ?
      {
        type: 7,
        ip: hostname,
      } : {
        type: 2,
        value: hostname,
      } ],
  }]);
  cert.sign(privateKey, forge.md.sha256.create());

  return {
    key: privateKey,
    cert,
  };
}

function defer() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve,
    reject,
  };
}

module.exports = {
  createCACert,
  createCertificate,
  defer,
};

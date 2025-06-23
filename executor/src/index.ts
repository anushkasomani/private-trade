import express from 'express';
import cors from 'cors';
import { CipherSuite, HkdfSha256 } from '@hpke/core';
import { DhkemX25519HkdfSha256 } from '@hpke/dhkem-x25519';
import { Chacha20Poly1305 } from '@hpke/chacha20poly1305';
import * as fs from 'fs';
import { verifyMessage } from 'ethers';

const suite = new CipherSuite({
  kem: new DhkemX25519HkdfSha256(),
  kdf: new HkdfSha256(),
  aead: new Chacha20Poly1305(),
});

function arrayBufferToBase64url(buf: ArrayBuffer) {
  return Buffer.from(buf).toString('base64url');
}
function arrayBufferToBase64(buf: ArrayBuffer) {
  return Buffer.from(buf).toString('base64');
}
function base64ToUint8Array(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

let recipientPrivKey: CryptoKey;
let recipientPubKey: CryptoKey;
(async () => {
    const rkp = await suite.kem.generateKeyPair();
    recipientPrivKey = rkp.privateKey;
    recipientPubKey = rkp.publicKey;
    const pubKeyBuf = await suite.kem.serializePublicKey(rkp.publicKey);
    const privKeyBuf = await suite.kem.serializePrivateKey(rkp.privateKey);
    const pubKey = arrayBufferToBase64url(pubKeyBuf);
    const privKey = arrayBufferToBase64url(privKeyBuf);
    fs.writeFileSync('.hpke-secret', privKey);
    fs.writeFileSync('../../frontend/public/hpke-key.txt', pubKey);
    console.log('HPKE keypair generated & saved.');
})();

const app = express();
app.use(cors());
app.use(express.json({ limit: '512kb' }));

app.post('/submit', async (req, res) => {
  try {
    console.log("the request is " , req.body)
    const { encBase64, ctcBase64 } = req.body;
    console.log("enc is ", encBase64 )
    console.log("ctc is ", ctcBase64 )
const encBuf = Buffer.from(encBase64, 'base64'); // or base64url
const encArrayBuffer = encBuf.buffer.slice(encBuf.byteOffset, encBuf.byteOffset + encBuf.byteLength);
const ctBuf = Buffer.from(ctcBase64, 'base64');
const ctArrayBuffer = ctBuf.buffer.slice(ctBuf.byteOffset, ctBuf.byteOffset + ctBuf.byteLength);
console.log("encArrayBuffer is ", encArrayBuffer)
console.log("ctArrayBuffer is ", ctArrayBuffer)
//     const encBuf = Buffer.from(enc, 'base64'); // or base64url
// const encArrayBuffer = encBuf.buffer.slice(encBuf.byteOffset, encBuf.byteOffset + encBuf.byteLength);
// console.log("encArrayBuffer is ", encArrayBuffer)
// const ctBuf = Buffer.from(ctc, 'base64');
// const ctArrayBuffer = ctBuf.buffer.slice(ctBuf.byteOffset, ctBuf.byteOffset + ctBuf.byteLength);
// console.log("ctArrayBuffer is ", ctArrayBuffer)
    if (!recipientPrivKey) throw new Error('HPKE private key not loaded!');

  
    //try
    const sender= await suite.createSenderContext({
      recipientPublicKey: recipientPubKey
    })
       const recipient1 = await suite.createRecipientContext({
      recipientKey: recipientPrivKey,
      enc: sender.enc,
    });
     const ctServer = await sender.seal(new TextEncoder().encode("Hello world!"));
     const ptServer = await recipient1.open(ctServer);
     console.log('Decrypted payload (server):', ctServer);
    // HPKE Decrypt
       const recipient2 = await suite.createRecipientContext({
      recipientKey: recipientPrivKey,
      enc: sender.enc,
    });

    
     const pt = await recipient2.open(ctArrayBuffer);
     console.log(new TextDecoder().decode(pt));
    // const pt = await recipient.open(ctBytes);
    // const textFetched = new TextDecoder().decode(pt);
    // console.log('Decrypted payload (JSON):', textFetched);

    // Extract and verify signature
    // const { payload, sig } = JSON.parse(textFetched);
    // const recovered = verifyMessage(JSON.stringify(payload), sig);
    // if (recovered.toLowerCase() !== payload.trader.toLowerCase()) {
    //   throw new Error('bad signature');
    // }
    // console.log('✅ Burner wallet + HPKE worked! Trade:', payload);

    res.json({ ok: true });
  } catch (e) {
    console.error('❌ Error:', e);
    res.status(400).json({ error: 'decrypt, parse, or sig failed' });
  }
});

app.listen(8080, () => console.log('🟢 Listening on :8080'));

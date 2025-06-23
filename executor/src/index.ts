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

// Load/generate HPKE keys (do this ONCE, outside request handler)
let recipientPrivKey: CryptoKey;
(async () => {
  if (!fs.existsSync('.hpke-secret')) {
    const rkp = await suite.kem.generateKeyPair();
    recipientPrivKey = rkp.privateKey;
    const pubKeyBuf = await suite.kem.serializePublicKey(rkp.publicKey);
    const privKeyBuf = await suite.kem.serializePrivateKey(rkp.privateKey);
    const pubKey = arrayBufferToBase64url(pubKeyBuf);
    const privKey = arrayBufferToBase64url(privKeyBuf);
    fs.writeFileSync('.hpke-secret', privKey);
    fs.writeFileSync('../../frontend/public/hpke-key.txt', pubKey);
    console.log('HPKE keypair generated & saved.');
  } else {
     console.log('Loading existing HPKE keypair...');
  }
})();

const app = express();
app.use(cors());
app.use(express.json({ limit: '512kb' }));

app.post('/submit', async (req, res) => {
  try {
    const { enc, ct } = req.body;
    if (!recipientPrivKey) throw new Error('HPKE private key not loaded!');

    // Decode from base64
    const encBytes = base64ToUint8Array(enc);
    const ctBytes = base64ToUint8Array(ct);

    // HPKE Decrypt
    const recipient = await suite.createRecipientContext({
      recipientKey: recipientPrivKey,
      enc: encBytes,
    });
    const pt = await recipient.open(ctBytes);
    const textFetched = new TextDecoder().decode(pt);
    console.log('Decrypted payload (JSON):', textFetched);

    // Extract and verify signature
    const { payload, sig } = JSON.parse(textFetched);
    const recovered = verifyMessage(JSON.stringify(payload), sig);
    if (recovered.toLowerCase() !== payload.trader.toLowerCase()) {
      throw new Error('bad signature');
    }
    console.log('✅ Burner wallet + HPKE worked! Trade:', payload);

    res.json({ ok: true });
  } catch (e) {
    console.error('❌ Error:', e);
    res.status(400).json({ error: 'decrypt, parse, or sig failed' });
  }
});

app.listen(8080, () => console.log('🟢 Listening on :8080'));

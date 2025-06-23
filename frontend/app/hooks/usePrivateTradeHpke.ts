import { useEffect, useState } from 'react';
import { Wallet } from 'ethers';
import { CipherSuite, HkdfSha256 } from '@hpke/core';
import { DhkemX25519HkdfSha256 } from '@hpke/dhkem-x25519';
import { Chacha20Poly1305 } from '@hpke/chacha20poly1305';

const suite = new CipherSuite({
  kem: new DhkemX25519HkdfSha256(),
  kdf: new HkdfSha256(),
  aead: new Chacha20Poly1305(),
});

function base64urlToUint8Array(base64url: string): Uint8Array {
  let b64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = typeof window !== 'undefined' ? window.atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; ++i) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function usePrivateTradeHpke() {
  const [botPk, setBotPk] = useState<CryptoKey | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/hpke-key.txt');
      const b64 = await res.text();
      const pubkeyBytes = base64urlToUint8Array(b64);
      const pubkeyBuffer = pubkeyBytes.buffer.slice(pubkeyBytes.byteOffset, pubkeyBytes.byteOffset + pubkeyBytes.byteLength) as ArrayBuffer;
      const deserialized = await suite.kem.deserializePublicKey(pubkeyBuffer);
      setBotPk(deserialized);
    })();
  }, []);

  return async function sendPrivateTrade(
    assetId: number,
    qty: bigint,
    margin: bigint
  ) {
    if (!botPk) throw new Error('Bot key not loaded yet');
    const burner = Wallet.createRandom();
    const payload = {
      trader: burner.address,
      assetId,
      qty: qty.toString(),
      margin: margin.toString(),
      ts: Date.now(),
    };
    const payloadJson = JSON.stringify(payload);
    const sig = await burner.signMessage(payloadJson);

    // Combine payload and sig
    const message = JSON.stringify({ payload, sig });
    const encodedPayload = new TextEncoder().encode(message);

    // HPKE Encrypt
    const sender = await suite.createSenderContext({ recipientPublicKey: botPk });
    const ciphertext = await sender.seal(encodedPayload.buffer.slice(encodedPayload.byteOffset, encodedPayload.byteOffset + encodedPayload.byteLength) as ArrayBuffer);

    // Encode to base64 for transport
    const encB64 = Buffer.from(sender.enc).toString('base64');
    const ctB64 = Buffer.from(ciphertext).toString('base64');

    await fetch('http://localhost:8080/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enc: encB64, ct: ctB64 }),
    });

    alert('Trade sent privately 🚀');
  };
}

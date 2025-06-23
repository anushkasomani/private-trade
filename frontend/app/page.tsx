'use client';
import { usePrivateTradeHpke } from './hooks/usePrivateTradeHpke';

export default function Demo() {
  const sendTrade = usePrivateTradeHpke();

  async function handleClick() {
    await sendTrade(0, 5n * 10n ** 18n, 1_000_000n);
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>Private Trade Demo</h1>
      <button
        onClick={handleClick}
        style={{ backgroundColor: '#FF007A', color: 'white', padding: '8px 16px', border: 'none', borderRadius: 4 }}
      >
        Send Private Order
      </button>
    </main>
  );
}

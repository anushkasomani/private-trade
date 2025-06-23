import { Wallet } from "ethers";

export async function burnTrade(){
  try{
      const burner = Wallet.createRandom();
    const payload = {
        trader: burner.address,
        assetId: 0,
        qty: (5n * 10n ** 18n).toString(),
        margin: 1_000_000n.toString(),
        ts: Date.now(),
    };
    const payloadJson = JSON.stringify(payload);
    const sig = await burner.signMessage(payloadJson);
    
    // Combine payload and sig
    const message = JSON.stringify({ payload, sig });
    
    console.log("Burner address:", burner.address);
    console.log("Message to burn:", message);
    const response = await fetch('http://localhost:8090/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: message,
    });
    const data = await response.json();
    console.log("Response from server:", data);
  }
  catch (e) {
    console.error("❌ Error:", e); 

  }
}

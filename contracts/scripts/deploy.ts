// scripts/deploy.ts - Simple deployment script
import { ethers } from "hardhat";
import { writeFileSync } from "fs";

async function main() {
  console.log("🚀 Deploying contracts...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  
  // Deploy Mock Verifier (for testing)
  console.log("\n📝 Deploying MockVerifier...");
  const MockVerifier = await ethers.getContractFactory("MockVerifier");
  const mockVerifier = await MockVerifier.deploy();
  await mockVerifier.waitForDeployment();
  const verifierAddress = await mockVerifier.getAddress();
  console.log("MockVerifier deployed to:", verifierAddress);

  const coreAddress = process.env.PERP_ENGINE_CORE_ADDRESS!;
  
  // Deploy PerpEngineZK
  console.log("\n📝 Deploying PerpEngineZK...");
  const PerpEngineZK = await ethers.getContractFactory("PerpEngineZK");
  const perpEngineZK = await PerpEngineZK.deploy(verifierAddress, coreAddress);
  await perpEngineZK.waitForDeployment();
  const perpAddress = await perpEngineZK.getAddress();
  console.log("PerpEngineZK deployed to:", perpAddress);
  
  // Save addresses
  const addresses = {
    mockVerifier: verifierAddress,
    mockCore: coreAddress,
    perpEngineZK: perpAddress,
    deployer: deployer.address,
    network: "fuji"
  };
  
  writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
  
  // Generate .env update
  const envUpdate = `
# Deployed Contract Addresses
PERP_ENGINE_CORE_ADDRESS=${perpAddress}
`;
  
  writeFileSync(".env.deployed", envUpdate);
  
  console.log("\n✅ Deployment complete!");
  console.log("📄 Addresses saved to: deployed-addresses.json");
  console.log("📄 Env vars saved to: .env.deployed");
  console.log("\n📋 Deployed Contracts:");
  console.log("PerpEngineZK:", perpAddress);
  console.log("MockVerifier:", verifierAddress);
  console.log("MockCore:", coreAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
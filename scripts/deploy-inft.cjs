// Deploys MockOracle + INFT to the 0G Galileo testnet, then writes the two
// addresses back to .env so the app can pick them up immediately.
//   npx hardhat run scripts/deploy-inft.cjs --network zg
const fs = require("node:fs/promises");
const path = require("node:path");
const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log("Deployer:", signer.address);
  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "OG");

  console.log("\nDeploying MockOracle...");
  const MockOracle = await hre.ethers.getContractFactory("MockOracle");
  const oracle = await MockOracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("MockOracle deployed at:", oracleAddress);

  console.log("\nDeploying INFT...");
  const INFT = await hre.ethers.getContractFactory("INFT");
  const inft = await INFT.deploy("Ajently Agents", "AJENT", oracleAddress);
  await inft.waitForDeployment();
  const inftAddress = await inft.getAddress();
  const deployTx = inft.deploymentTransaction();
  console.log("INFT deployed at:   ", inftAddress);
  console.log("Deploy tx:          ", deployTx?.hash);

  // Persist addresses to .env so the running app picks them up.
  const envPath = path.resolve(__dirname, "..", ".env");
  let env = await fs.readFile(envPath, "utf-8");

  function upsert(key, value) {
    const line = `${key}=${value}`;
    env = env.match(new RegExp(`^${key}=.*$`, "m")) ? env.replace(new RegExp(`^${key}=.*$`, "m"), line) : `${env.replace(/\s+$/, "")}\n${line}\n`;
  }
  upsert("INFT_CONTRACT_ADDRESS", inftAddress);
  upsert("INFT_ORACLE_ADDRESS", oracleAddress);
  upsert("INFT_CHAIN_ID", "16602");
  upsert("INFT_DEPLOY_TX", deployTx?.hash || "");
  await fs.writeFile(envPath, env, "utf-8");
  console.log("\n.env updated with INFT_CONTRACT_ADDRESS, INFT_ORACLE_ADDRESS, INFT_CHAIN_ID, INFT_DEPLOY_TX");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

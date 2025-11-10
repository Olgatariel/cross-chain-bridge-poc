const hre = require("hardhat");

async function main() {
  
  const [sender] = await ethers.getSigners(); 
  console.log("Sender address:", sender.address);

  const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";


  const tx = await sender.sendTransaction({
    to: contractAddress,
    value: ethers.parseEther("0.5"),
  });

  await tx.wait();
  console.log("✅ Sent 0.5 ETH to contract:", contractAddress);

  const balance = await ethers.provider.getBalance(contractAddress);
  console.log("💰 Contract balance:", ethers.formatEther(balance), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1; 
});
const {ethers} = require("hardhat");

async function main() {
  const [owner, user1] = await ethers.getSigners();

  console.log("==Testing Accounts==");
  console.log("Owner address:", owner.address);
  console.log("User1 address:", user1.address);

  const tokenAddr = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const treasuryAddr = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const crowdsaleAddr = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

  const token = await ethers.getContractAt("TarToken", tokenAddr);
  const treasury = await ethers.getContractAt("Treasury", treasuryAddr);
  const crowdsale = await ethers.getContractAt("Crowdsale", crowdsaleAddr);

  console.log("\n==TestingToken availability=");
  const tokenInCrowdsale = await token.balanceOf(crowdsaleAddr);
  console.log("TAR tokens in Crowdsale:", ethers.formatEther(tokenInCrowdsale));


  console.log("==Check that crowdsale authorized in Treasury=",
  await treasury.isAuthorized(crowdsaleAddr));


  const treasuryETH = await ethers.provider.getBalance(treasuryAddr);
  console.log("Amount ETH in Treasury is:", ethers.formatEther(treasuryETH));
}

main().catch(console.error);



  
const { ethers } = require("hardhat");

async function main() {
    const [user, relayer] = await ethers.getSigners();

    console.log("User address:", user.address);
    console.log("Relayer address:", relayer.address);

    // Chain A: Token + Consumer
    const tokenAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707"; 
    const consumerAddress = "0x0165878A594ca255338adfa4d48449f69242Eb8F";

    const token = await ethers.getContractAt("Token1", tokenAddress, user);
    const consumer = await ethers.getContractAt("TokenConsumer", consumerAddress, user);

    const balanceBefore = await token.balanceOf(user.address);
    console.log("User balance before deposit:", ethers.formatUnits(balanceBefore, 18));

    const amountToApprove = ethers.parseUnits("100", 18);
    const destinationChainId = 137; // Polygon

    // Approve
    const approveTx = await token.approve(consumer.target, amountToApprove);
    await approveTx.wait();
    console.log(`Approved ${ethers.formatUnits(amountToApprove, 18)} tokens for Consumer`);

    // Deposit
    const depositTx = await consumer.deposit(amountToApprove, destinationChainId);
    await depositTx.wait();
    console.log(`Deposited ${ethers.formatUnits(amountToApprove, 18)} tokens to Consumer for chain ${destinationChainId}`);

    const balanceAfter = await token.balanceOf(user.address);
    const consumerBalance = await token.balanceOf(consumer.target);
    console.log("User balance after deposit:", ethers.formatUnits(balanceAfter, 18));
    console.log("Consumer contract balance:", ethers.formatUnits(consumerBalance, 18));

    // Chain B: VirtualBalanceVault 
    const vaultAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853"; 
    const vault = await ethers.getContractAt("VirtualBalanceVault", vaultAddress, relayer);

    // Relayer credits user
    const creditTx = await vault.credit(user.address, amountToApprove);
    await creditTx.wait();
    console.log(`Relayer credited ${ethers.formatUnits(amountToApprove, 18)} virtual tokens to user`);

    const userVirtualBalance = await vault.getBalance(user.address);
    console.log("User virtual balance on Chain B:", ethers.formatUnits(userVirtualBalance, 18));

    
    const vaultAsUser = vault.connect(user);
    const spendAmount = ethers.parseUnits("50", 18);
    const spendTx = await vaultAsUser.spend(spendAmount);
    await spendTx.wait();
    console.log(`User spent ${ethers.formatUnits(spendAmount, 18)} virtual tokens`);

    const finalBalance = await vault.getBalance(user.address);
    console.log("User virtual balance after spend:", ethers.formatUnits(finalBalance, 18));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
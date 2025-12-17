const {ethers} = require ("hardhat");

async function main() {
    const [user] = await ethers.getSigners();
    console.log("Using user:", user.address);
    const tokenAddress =  "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    const consumerAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
    const token = await ethers.getContractAt(
        "Token1",
        tokenAddress,
        user
    );
    const consumer = await ethers.getContractAt(
        "TokenConsumer",
        consumerAddress,
        user
    );
    console.log("Token address:", await token.getAddress());
    console.log("Consumer address:", await consumer.getAddress());
    const balanceBefore = await token.balanceOf(user.address);
    console.log(
        "User balance before:",
        ethers.formatUnits(balanceBefore, 18)
    );
    const amountToApprove = ethers.parseUnits("100", 18);
    const approveTx = await token.approve(consumer.target, amountToApprove);
    await approveTx.wait();
    console.log(`Approved ${ethers.formatUnits(amountToApprove, 18)} tokens for Consumer`);
    const depositTx = await consumer.deposit(amountToApprove);
    await depositTx.wait();
    console.log(`Deposited ${ethers.formatUnits(amountToApprove, 18)} tokens to Consumer`);
    const balanceAfter = await token.balanceOf(user.address);
    console.log(
        "User balance after:",
        ethers.formatUnits(balanceAfter, 18)
    );
    const consumerBalance = await token.balanceOf(consumer.target);
    console.log(
        "Consumer contract balance:",
        ethers.formatUnits(consumerBalance, 18)
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});    

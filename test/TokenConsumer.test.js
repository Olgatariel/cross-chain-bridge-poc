const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenConsumer", function () {
    let consumer;
    let token;
    let owner, user1;

    const DEST_CHAIN_ID = 137; // Polygon

    beforeEach(async function () {
        [owner, user1] = await ethers.getSigners();

        const Token = await ethers.getContractFactory("Token1");
        token = await Token.deploy(ethers.parseEther("1000"));
        await token.waitForDeployment();

        const Consumer = await ethers.getContractFactory("TokenConsumer");
        consumer = await Consumer.deploy(await token.getAddress());
        await consumer.waitForDeployment();
    });

    describe("deposit", function () {
        it("Should deposit tokens correctly and emit event", async function () {
            const amount = ethers.parseEther("100");

            await token.approve(consumer.target, amount);

            await expect(
                consumer.deposit(amount, DEST_CHAIN_ID)
            )
                .to.emit(consumer, "DepositIntent")
                .withArgs(owner.address, amount, DEST_CHAIN_ID);

            expect(await token.balanceOf(owner.address))
                .to.equal(ethers.parseEther("900"));

            expect(await token.balanceOf(consumer.target))
                .to.equal(amount);

            const deposit = await consumer.getDeposit(owner.address, 0);
            expect(deposit.amount).to.equal(amount);
            expect(deposit.destinationChainId).to.equal(DEST_CHAIN_ID);
        });

        it("Should revert if amount is zero", async function () {
            await expect(
                consumer.deposit(0, DEST_CHAIN_ID)
            ).to.be.revertedWithCustomError(consumer, "ZeroAmount");
        });

        it("Should revert if destinationChainId is zero", async function () {
            const amount = ethers.parseEther("10");

            await token.approve(consumer.target, amount);

            await expect(
                consumer.deposit(amount, 0)
            ).to.be.revertedWithCustomError(consumer, "InvalidDestination");
        });

        it("Should revert if allowance is insufficient", async function () {
            const amount = ethers.parseEther("100");

            await token.approve(consumer.target, ethers.parseEther("50"));

            await expect(
                consumer.deposit(amount, DEST_CHAIN_ID)
            ).to.be.revertedWithCustomError(
                token,
                "ERC20InsufficientAllowance"
            );

            expect(await token.balanceOf(consumer.target)).to.equal(0);
        });

        it("Should revert if balance is insufficient", async function () {
            const amount = ethers.parseEther("1100");

            await token.approve(consumer.target, amount);

            await expect(
                consumer.deposit(amount, DEST_CHAIN_ID)
            ).to.be.revertedWithCustomError(
                token,
                "ERC20InsufficientBalance"
            );

            expect(await token.balanceOf(consumer.target)).to.equal(0);
        });

        it("Should correctly increase deposits count", async function () {
            const amount = ethers.parseEther("50");

            await token.approve(consumer.target, amount);
            await consumer.deposit(amount, DEST_CHAIN_ID);

            expect(
                await consumer.getDepositsCount(owner.address)
            ).to.equal(1);
        });
    });
});
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenConsumer", function() {
    let consumer;
    let token;
    let owner, user1;

    beforeEach(async function() {
        [owner, user1] = await ethers.getSigners();

        const Token = await ethers.getContractFactory("Token1");
        token = await Token.deploy(ethers.parseEther("1000"));
        await token.waitForDeployment();

        const Consumer = await ethers.getContractFactory("TokenConsumer");
        consumer = await Consumer.deploy(await token.getAddress());
        await consumer.waitForDeployment();
    });

    describe("Deployment", () => {
        it("Should deposit tokens correctly", async () => {
            const depositAmount = ethers.parseEther("100");

            await token.approve(consumer.target, depositAmount);

            const allowanceBefore = await token.allowance(owner.address, consumer.target);
            expect(allowanceBefore).to.equal(depositAmount);

            await consumer.deposit(depositAmount);

            const ownerBalanceAfter = await token.balanceOf(owner.address);
            const consumerBalance = await token.balanceOf(consumer.target);
        
            expect(ownerBalanceAfter).to.equal(ethers.parseEther("900")); 
            expect(consumerBalance).to.equal(depositAmount);

            const remainingAllowance = await token.allowance(owner.address, consumer.target);
            expect(remainingAllowance).to.equal(0);
        }); 

        it("Should fail if deposit exceeds allowance", async () => {
            const depositAmount = ethers.parseEther("100");
            await token.approve(consumer.target, ethers.parseEther("50"));
            await expect(consumer.deposit(depositAmount))
                .to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
            
            const ownerBalance = await token.balanceOf(owner.address);
            const consumerBalance = await token.balanceOf(consumer.target);
            
            expect(ownerBalance).to.equal(ethers.parseEther("1000"));
            expect(consumerBalance).to.equal(0);
        });

        it("Should fail if deposit exceeds owner balance", async () => {
            const depositAmount = ethers.parseEther("1100"); 
            await token.approve(consumer.target, depositAmount); 
            await expect(consumer.deposit(depositAmount))
                .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
            
            const ownerBalance = await token.balanceOf(owner.address);
            const consumerBalance = await token.balanceOf(consumer.target);
            
            expect(ownerBalance).to.equal(ethers.parseEther("1000"));
            expect(consumerBalance).to.equal(0);
        });
    });
});
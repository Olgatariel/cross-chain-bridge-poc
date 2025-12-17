const { expect } = require("chai");
const { ethers } = require("hardhat");

describe ("Token1", function(){
    let token;
    let owner, user1
    const initialSupply = ethers.parseEther("1000");

    beforeEach(async function() {
        [owner, user1] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("Token1");
        token = await Token.deploy(initialSupply);
        await token.waitForDeployment();
    });

    describe("Deployment", () => {
        it("Should check that totalSupply() = initialSupply", async () => {
            expect(await token.totalSupply()).to.equal(initialSupply);
        });
        it("Should check that owner balance equal to initialSupply", async () => {
            expect(await token.balanceOf(owner.address)).to.equal(initialSupply);
        });
        it("Should approve tokens transfer correctly", async () => {
            const allowanceAmount = ethers.parseEther("100");
            await token.approve(user1.address, allowanceAmount);
            const actualAllowance = await token.allowance(owner.address, user1.address);
            expect(actualAllowance).to.equal(allowanceAmount);
        });
        it("Should make tarnsfer token correctly", async() => {
            const allowanceAmount = ethers.parseEther("100");

            await token.approve(user1.address, allowanceAmount);
            await token.connect(user1).transferFrom(owner.address, user1.address, allowanceAmount);

            expect(await token.balanceOf(owner.address)).to.equal(ethers.parseEther("900"));
            expect(await token.balanceOf(user1.address)).to.equal(allowanceAmount);

            const allowanceBalance = await token.allowance(owner.address, user1.address);
            expect(allowanceBalance).to.equal(0);
        });
    })
})
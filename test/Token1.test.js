const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Token1", function () {
    let token;
    let owner;
    let addr1;
    let addr2;

    const INITIAL_SUPPLY = ethers.parseEther("1000000");
    const FAUCET_AMOUNT = ethers.parseEther("100");

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
        
        const Token1 = await ethers.getContractFactory("Token1");
        token = await Token1.deploy(INITIAL_SUPPLY);
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await token.owner()).to.equal(owner.address);
        });

        it("Should assign the initial supply to owner", async function () {
            const ownerBalance = await token.balanceOf(owner.address);
            expect(ownerBalance).to.equal(INITIAL_SUPPLY);
        });

        it("Should have correct name and symbol", async function () {
            expect(await token.name()).to.equal("Token1");
            expect(await token.symbol()).to.equal("TKN1");
        });
    });

    describe("Minting", function () {
        it("Should allow owner to mint tokens", async function () {
            const mintAmount = ethers.parseEther("1000");
            await token.mint(addr1.address, mintAmount);
            
            expect(await token.balanceOf(addr1.address)).to.equal(mintAmount);
        });

        it("Should fail if non-owner tries to mint", async function () {
            const mintAmount = ethers.parseEther("1000");
            await expect(
                token.connect(addr1).mint(addr2.address, mintAmount)
            ).to.be.reverted;
        });

        it("Should update total supply after minting", async function () {
            const mintAmount = ethers.parseEther("1000");
            const initialSupply = await token.totalSupply();
            
            await token.mint(addr1.address, mintAmount);
            
            expect(await token.totalSupply()).to.equal(initialSupply + mintAmount);
        });
    });

    describe("Faucet", function () {
        it("Should allow user to claim faucet tokens", async function () {
            await token.connect(addr1).claimFaucet();
            
            expect(await token.balanceOf(addr1.address)).to.equal(FAUCET_AMOUNT);
        });

        it("Should update lastClaim timestamp", async function () {
            await token.connect(addr1).claimFaucet();
            
            const lastClaim = await token.lastClaim(addr1.address);
            expect(lastClaim).to.be.gt(0);
        });

        it("Should not allow claiming twice within 24 hours", async function () {
            await token.connect(addr1).claimFaucet();
            
            await expect(
                token.connect(addr1).claimFaucet()
            ).to.be.revertedWith("Wait 24h");
        });

        it("Should allow claiming after 24 hours", async function () {
            // First claim
            await token.connect(addr1).claimFaucet();
            expect(await token.balanceOf(addr1.address)).to.equal(FAUCET_AMOUNT);
            
            // Increase time by 24 hours + 1 second
            await time.increase(24 * 60 * 60 + 1);
            
            // Second claim
            await token.connect(addr1).claimFaucet();
            expect(await token.balanceOf(addr1.address)).to.equal(FAUCET_AMOUNT * 2n);
        });

        it("Should allow multiple users to claim independently", async function () {
            await token.connect(addr1).claimFaucet();
            await token.connect(addr2).claimFaucet();
            
            expect(await token.balanceOf(addr1.address)).to.equal(FAUCET_AMOUNT);
            expect(await token.balanceOf(addr2.address)).to.equal(FAUCET_AMOUNT);
        });

        it("Should increase total supply when faucet is claimed", async function () {
            const initialSupply = await token.totalSupply();
            
            await token.connect(addr1).claimFaucet();
            
            expect(await token.totalSupply()).to.equal(initialSupply + FAUCET_AMOUNT);
        });
    });

    describe("Standard ERC20 functions", function () {
        beforeEach(async function () {
            // Give addr1 some tokens
            await token.transfer(addr1.address, ethers.parseEther("1000"));
        });

        it("Should transfer tokens between accounts", async function () {
            const amount = ethers.parseEther("100");
            await token.connect(addr1).transfer(addr2.address, amount);
            
            expect(await token.balanceOf(addr2.address)).to.equal(amount);
        });

        it("Should handle approvals correctly", async function () {
            const amount = ethers.parseEther("100");
            await token.connect(addr1).approve(addr2.address, amount);
            
            expect(await token.allowance(addr1.address, addr2.address)).to.equal(amount);
        });

        it("Should allow transferFrom with approval", async function () {
            const amount = ethers.parseEther("100");
            
            await token.connect(addr1).approve(addr2.address, amount);
            await token.connect(addr2).transferFrom(addr1.address, addr2.address, amount);
            
            expect(await token.balanceOf(addr2.address)).to.equal(amount);
        });
    });
});
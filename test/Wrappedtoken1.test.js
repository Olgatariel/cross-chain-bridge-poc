const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WrappedToken1", function () {
    let wrappedToken;
    let owner;
    let bridge;
    let user1;
    let user2;

    const TOKEN_NAME = "Wrapped Token1";
    const TOKEN_SYMBOL = "wTKN1";
    const BRIDGE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BRIDGE_ROLE"));

    beforeEach(async function () {
        [owner, bridge, user1, user2] = await ethers.getSigners();
        
        // Deploy WrappedToken1
        const WrappedToken1 = await ethers.getContractFactory("WrappedToken1");
        wrappedToken = await WrappedToken1.deploy(TOKEN_NAME, TOKEN_SYMBOL);
        
        // Grant BRIDGE_ROLE to bridge address
        await wrappedToken.grantRole(BRIDGE_ROLE, bridge.address);
    });

    describe("Deployment", function () {
        it("Should set the correct name and symbol", async function () {
            expect(await wrappedToken.name()).to.equal(TOKEN_NAME);
            expect(await wrappedToken.symbol()).to.equal(TOKEN_SYMBOL);
        });

        it("Should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
            const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
            expect(
                await wrappedToken.hasRole(DEFAULT_ADMIN_ROLE, owner.address)
            ).to.be.true;
        });

        it("Should have zero initial supply", async function () {
            expect(await wrappedToken.totalSupply()).to.equal(0);
        });

        it("Should have correct BRIDGE_ROLE hash", async function () {
            expect(await wrappedToken.BRIDGE_ROLE()).to.equal(BRIDGE_ROLE);
        });
    });

    describe("Access Control", function () {
        it("Should allow admin to grant BRIDGE_ROLE", async function () {
            await wrappedToken.grantRole(BRIDGE_ROLE, user1.address);
            expect(await wrappedToken.hasRole(BRIDGE_ROLE, user1.address)).to.be.true;
        });

        it("Should allow admin to revoke BRIDGE_ROLE", async function () {
            await wrappedToken.grantRole(BRIDGE_ROLE, user1.address);
            await wrappedToken.revokeRole(BRIDGE_ROLE, user1.address);
            expect(await wrappedToken.hasRole(BRIDGE_ROLE, user1.address)).to.be.false;
        });

        it("Should not allow non-admin to grant roles", async function () {
            await expect(
                wrappedToken.connect(user1).grantRole(BRIDGE_ROLE, user2.address)
            ).to.be.reverted;
        });
    });

    describe("Minting", function () {
        const mintAmount = ethers.parseEther("1000");

        it("Should allow BRIDGE_ROLE to mint tokens", async function () {
            await wrappedToken.connect(bridge).mint(user1.address, mintAmount);
            
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(mintAmount);
        });

        it("Should increase total supply after minting", async function () {
            const initialSupply = await wrappedToken.totalSupply();
            
            await wrappedToken.connect(bridge).mint(user1.address, mintAmount);
            
            expect(await wrappedToken.totalSupply()).to.equal(initialSupply + mintAmount);
        });

        it("Should emit TokensMinted event", async function () {
            await expect(
                wrappedToken.connect(bridge).mint(user1.address, mintAmount)
            )
                .to.emit(wrappedToken, "TokensMinted")
                .withArgs(user1.address, mintAmount);
        });

        it("Should not allow non-bridge to mint", async function () {
            await expect(
                wrappedToken.connect(user1).mint(user2.address, mintAmount)
            ).to.be.reverted;
        });

        it("Should allow multiple mints", async function () {
            await wrappedToken.connect(bridge).mint(user1.address, mintAmount);
            await wrappedToken.connect(bridge).mint(user1.address, mintAmount);
            
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(mintAmount * 2n);
        });

        it("Should mint to multiple addresses", async function () {
            await wrappedToken.connect(bridge).mint(user1.address, mintAmount);
            await wrappedToken.connect(bridge).mint(user2.address, mintAmount);
            
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(mintAmount);
            expect(await wrappedToken.balanceOf(user2.address)).to.equal(mintAmount);
        });

        it("Should allow minting zero tokens (edge case)", async function () {
            // OpenZeppelin allows minting 0 tokens
            await wrappedToken.connect(bridge).mint(user1.address, 0);
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(0);
        });
    });

    describe("Burning", function () {
        const mintAmount = ethers.parseEther("1000");
        const burnAmount = ethers.parseEther("500");

        beforeEach(async function () {
            // Mint some tokens to user1 first
            await wrappedToken.connect(bridge).mint(user1.address, mintAmount);
        });

        it("Should allow BRIDGE_ROLE to burn tokens from user", async function () {
            await wrappedToken.connect(bridge).burn(user1.address, burnAmount);
            
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(
                mintAmount - burnAmount
            );
        });

        it("Should decrease total supply after burning", async function () {
            const initialSupply = await wrappedToken.totalSupply();
            
            await wrappedToken.connect(bridge).burn(user1.address, burnAmount);
            
            expect(await wrappedToken.totalSupply()).to.equal(initialSupply - burnAmount);
        });

        it("Should emit TokensBurned event", async function () {
            await expect(
                wrappedToken.connect(bridge).burn(user1.address, burnAmount)
            )
                .to.emit(wrappedToken, "TokensBurned")
                .withArgs(user1.address, burnAmount);
        });

        it("Should not allow non-bridge to burn", async function () {
            await expect(
                wrappedToken.connect(user1).burn(user1.address, burnAmount)
            ).to.be.reverted;
        });

        it("Should revert if burning more than balance", async function () {
            const tooMuch = ethers.parseEther("2000");
            
            await expect(
                wrappedToken.connect(bridge).burn(user1.address, tooMuch)
            ).to.be.reverted; // ERC20: burn amount exceeds balance
        });

        it("Should burn all tokens", async function () {
            await wrappedToken.connect(bridge).burn(user1.address, mintAmount);
            
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(0);
            expect(await wrappedToken.totalSupply()).to.equal(0);
        });

        it("Should handle multiple burns", async function () {
            await wrappedToken.connect(bridge).burn(user1.address, burnAmount);
            await wrappedToken.connect(bridge).burn(user1.address, burnAmount);
            
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(0);
        });

        it("Should burn from different users independently", async function () {
            // Mint to user2 as well
            await wrappedToken.connect(bridge).mint(user2.address, mintAmount);
            
            // Burn from user1
            await wrappedToken.connect(bridge).burn(user1.address, burnAmount);
            
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(burnAmount);
            expect(await wrappedToken.balanceOf(user2.address)).to.equal(mintAmount);
        });

        it("Should allow burning zero tokens (edge case)", async function () {
            await wrappedToken.connect(bridge).burn(user1.address, 0);
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(mintAmount);
        });
    });

    describe("Standard ERC20 Functions", function () {
        const amount = ethers.parseEther("1000");

        beforeEach(async function () {
            // Mint tokens to user1
            await wrappedToken.connect(bridge).mint(user1.address, amount);
        });

        it("Should allow token transfers", async function () {
            const transferAmount = ethers.parseEther("100");
            await wrappedToken.connect(user1).transfer(user2.address, transferAmount);
            
            expect(await wrappedToken.balanceOf(user2.address)).to.equal(transferAmount);
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(amount - transferAmount);
        });

        it("Should handle approvals correctly", async function () {
            const approvalAmount = ethers.parseEther("500");
            await wrappedToken.connect(user1).approve(user2.address, approvalAmount);
            
            expect(await wrappedToken.allowance(user1.address, user2.address)).to.equal(
                approvalAmount
            );
        });

        it("Should allow transferFrom with approval", async function () {
            const transferAmount = ethers.parseEther("100");
            
            await wrappedToken.connect(user1).approve(user2.address, transferAmount);
            await wrappedToken.connect(user2).transferFrom(
                user1.address,
                user2.address,
                transferAmount
            );
            
            expect(await wrappedToken.balanceOf(user2.address)).to.equal(transferAmount);
        });

        it("Should return correct decimals", async function () {
            expect(await wrappedToken.decimals()).to.equal(18);
        });
    });

    describe("Integration: Mint and Burn Cycle", function () {
        it("Should handle complete mint -> transfer -> burn cycle", async function () {
            const amount = ethers.parseEther("1000");
            
            // Bridge mints tokens to user1
            await wrappedToken.connect(bridge).mint(user1.address, amount);
            expect(await wrappedToken.totalSupply()).to.equal(amount);
            
            // User transfers some tokens
            await wrappedToken.connect(user1).transfer(user2.address, amount / 2n);
            
            // Bridge burns from user1
            await wrappedToken.connect(bridge).burn(user1.address, amount / 2n);
            
            // Check final state
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(0);
            expect(await wrappedToken.balanceOf(user2.address)).to.equal(amount / 2n);
            expect(await wrappedToken.totalSupply()).to.equal(amount / 2n);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle role renouncement", async function () {
            await wrappedToken.connect(bridge).renounceRole(BRIDGE_ROLE, bridge.address);
            
            expect(await wrappedToken.hasRole(BRIDGE_ROLE, bridge.address)).to.be.false;
            
            // Should not be able to mint/burn anymore
            await expect(
                wrappedToken.connect(bridge).mint(user1.address, 100)
            ).to.be.reverted;
        });

        it("Should handle multiple bridge addresses", async function () {
            const bridge2 = user2;
            await wrappedToken.grantRole(BRIDGE_ROLE, bridge2.address);
            
            // Both bridges should be able to mint
            await wrappedToken.connect(bridge).mint(user1.address, ethers.parseEther("100"));
            await wrappedToken.connect(bridge2).mint(user1.address, ethers.parseEther("100"));
            
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(
                ethers.parseEther("200")
            );
        });
    });
});
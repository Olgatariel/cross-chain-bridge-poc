const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TarToken", function() {
    let token;
    let owner, user1, user2, user3;

    const MAX_SUPPLY = ethers.parseEther("1000000000");

    beforeEach(async function() {
        [owner, user1, user2, user3] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("TarToken");
        token = await Token.deploy();
        await token.waitForDeployment();
    });

    // DEPLOYMENT
    describe("Deployment", () => {  
        it("Should set the correct name", async () => {
            expect(await token.name()).to.equal("TarToken");
        });
        
        it("Should set the correct symbol", async () => {
            expect(await token.symbol()).to.equal("TAR");
        });
        
        it("Should set the correct decimals", async () => {
            expect(await token.decimals()).to.equal(18);
        });
        
        it("Should set the correct owner", async () => {
            expect(await token.owner()).to.equal(owner.address);
        });
        
        it("Should have zero initial supply", async () => {
            expect(await token.totalSupply()).to.equal(0);
        });
        
        it("Should set correct MAX_SUPPLY", async () => {
            expect(await token.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
        });
    });

    // MINT 
    describe("Mint", () => {  // ← ВІДСТУП ДОДАНО!
        it("Should allow owner to mint tokens", async () => {
            const amount = ethers.parseEther("1000");

            await token.mint(user1.address, amount);

            expect(await token.balanceOf(user1.address)).to.equal(amount);
            expect(await token.totalSupply()).to.equal(amount);
        });
        
        it("Should emit TokensMinted event", async () => {
            const amount = ethers.parseEther("1000");

            await expect(token.mint(user1.address, amount))
                .to.emit(token, "TokensMinted")
                .withArgs(user1.address, amount);
        });
        
        it("Should allow multiple mints", async () => {
            await token.mint(user1.address, ethers.parseEther("1000"));
            await token.mint(user2.address, ethers.parseEther("2000"));
            await token.mint(user3.address, ethers.parseEther("3000"));

            expect(await token.totalSupply()).to.equal(ethers.parseEther("6000"));
        });
        
        it("Should revert if non-owner tries to mint", async () => {
            await expect(
                token.connect(user1).mint(user2.address, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
        });
        
        it("Should revert if minting to zero address", async () => {
            await expect( 
                token.mint(ethers.ZeroAddress, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(token, "ZeroAddress");
        });
        
        it("Should revert if exceeds MAX_SUPPLY", async () => {
            const tooMuch = MAX_SUPPLY + 1n;

            await expect(
                token.mint(user1.address, tooMuch)
            ).to.be.revertedWithCustomError(token, "ExceedsMaxSupply");
        });
        
        it("Should revert if total mints exceed MAX_SUPPLY", async () => {
            await token.mint(user1.address, ethers.parseEther("999999999"));
            
            await expect(
                token.mint(user2.address, ethers.parseEther("2"))
            ).to.be.revertedWithCustomError(token, "ExceedsMaxSupply");
        });
        
        it("Should allow minting exactly MAX_SUPPLY", async () => {
            await token.mint(user1.address, MAX_SUPPLY);
            expect(await token.totalSupply()).to.equal(MAX_SUPPLY);
        });
        
        it("Should revert when paused", async () => {
            await token.pause();
            
            await expect(
                token.mint(user1.address, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(token, "EnforcedPause");
        });
    });  

    //  BURN 
    describe("Burn", () => {  
        beforeEach(async () => {
            await token.mint(user1.address, ethers.parseEther("5000"));
        });

        it("Should allow user to burn their tokens", async () => {
            const amount = ethers.parseEther("1000");
            
            await token.connect(user1).burn(amount);
            
            expect(await token.balanceOf(user1.address)).to.equal(
                ethers.parseEther("4000")
            );
            expect(await token.totalSupply()).to.equal(
                ethers.parseEther("4000")
            );
        });
        
        it("Should emit TokensBurned event", async () => {
            const amount = ethers.parseEther("1000");
            
            await expect(token.connect(user1).burn(amount))
                .to.emit(token, "TokensBurned")
                .withArgs(user1.address, amount);
        });

        it("Should revert if burning more than balance", async () => {
            await expect(
                token.connect(user1).burn(ethers.parseEther("10000"))
            ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
        });

        it("Should decrease totalSupply when burning", async () => {
            const totalBefore = await token.totalSupply();
            const burnAmount = ethers.parseEther("1000");
            
            await token.connect(user1).burn(burnAmount);
            
            expect(await token.totalSupply()).to.equal(totalBefore - burnAmount);
        });
    });

    // PAUSE
    describe("Pause Functionality", () => {  
        it("Should allow owner to pause", async () => {
            await token.pause();
            expect(await token.paused()).to.be.true;
        });

        it("Should allow owner to unpause", async () => {
            await token.pause();
            await token.unpause();
            expect(await token.paused()).to.be.false;
        });

        it("Should revert mint when paused", async () => {
            await token.pause();
            
            await expect(
                token.mint(user1.address, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(token, "EnforcedPause");
        });
        
        it("Should revert if non-owner tries to pause", async () => {
            await expect(
                token.connect(user1).pause()
            ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
        });
    });

    // INTEGRATION 
    describe("Integration", () => { 
        it("Should allow minting and transferring", async () => {
            await token.mint(user1.address, ethers.parseEther("1000"));
            await token.connect(user1).transfer(user2.address, ethers.parseEther("500"));
            
            expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther("500"));
        });

        it("Should allow minting, transferring and burning", async () => {
            await token.mint(user1.address, ethers.parseEther("1000"));
            await token.connect(user1).transfer(user2.address, ethers.parseEther("300"));
            await token.connect(user2).burn(ethers.parseEther("100"));
            
            expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther("200"));
            expect(await token.totalSupply()).to.equal(ethers.parseEther("900"));
        });
    });

}); 
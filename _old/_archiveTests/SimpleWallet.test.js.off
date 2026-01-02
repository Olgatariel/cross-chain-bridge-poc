const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleWallet", function() {
    let user1;
    let walletContract;

    beforeEach (async function() {
        [user1] = await ethers.getSigners();
        const SimpleWallet = await ethers.getContractFactory("SimpleWallet");
        walletContract = await SimpleWallet.deploy();
        await walletContract.waitForDeployment();
     });

     it("Deposit works correctly", async function() {
        await walletContract.connect(user1).deposit({ value: ethers.parseEther("1") });
        const userBalance = await walletContract.balances(user1.address);
        expect(userBalance).to.equal(ethers.parseEther("1"));
     });

     it("should revert if user tries to withdraw more than balance", async function() {
        await walletContract.connect(user1).deposit({ value: ethers.parseEther("0.5") });
        await expect(
            walletContract.connect(user1).withdraw(ethers.parseEther("1"))
        ).to.be.revertedWithCustomError(walletContract, "InsufficientBalance")
     });
    
     it("user can withdraw part of balance", async function() {
        await walletContract.connect(user1).deposit({ value: ethers.parseEther("2") });
        await expect(
            walletContract.connect(user1).withdraw(ethers.parseEther("1"))
        )
            .to.emit(walletContract, "Withdrawn")
            .withArgs(user1.address, ethers.parseEther("1"));
        
        const finalBalance = await walletContract.balances(user1.address);
        expect(finalBalance).to.equal(ethers.parseEther("1"));
    });
    
     it("should update contract's ether balance correctly", async function() {
        const initialBalance = await ethers.provider.getBalance(walletContract.target);
        expect(initialBalance).to.equal(0);

        await walletContract.connect(user1).deposit({ value: ethers.parseEther("1") });

        const afterDeposit = await ethers.provider.getBalance(walletContract.target);
        expect(afterDeposit).to.equal(ethers.parseEther("1"));

        await walletContract.connect(user1).withdraw(ethers.parseEther("1"));

        const afterWithdraw = await ethers.provider.getBalance(walletContract.target);
        expect(afterWithdraw).to.equal(0);

        });
        
     });

    
    

    
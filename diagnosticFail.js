require("dotenv").config();
const { ethers } = require("ethers");

async function diagnose() {
    console.log("\n🔍 ДІАГНОСТИКА ПОМИЛКИ WITHDRAWAL");
    console.log("=".repeat(60));
    
    const providerPolygon = new ethers.JsonRpcProvider(
        process.env.RPC_POLYGON || "https://rpc-amoy.polygon.technology"
    );
    
    const user = "0x9ab408371f230089612bc523a54edaddb6aa1d05";
    const bridgeAddress = "0xfc454442344ecf8502ddc7fb8ea90eb1d3178e1c";
    const wrappedTokenAddress = "0x9a801c2fF18234ce990c98d253Ebe6c49EB8eBEa";
    
    // Сума з помилки: 0x1158e460913d00000 = 20 tokens
    const amount = ethers.parseEther("20");
    
    console.log("\n📋 Параметри:");
    console.log("Користувач:", user);
    console.log("Bridge:", bridgeAddress);
    console.log("Сума:", ethers.formatEther(amount), "wTKN1");
    
    // 1. Перевір баланс wTKN1
    console.log("\n1️⃣ Перевірка балансу wTKN1...");
    const wrappedToken = new ethers.Contract(
        wrappedTokenAddress,
        [
            "function balanceOf(address) view returns (uint256)",
            "function allowance(address,address) view returns (uint256)"
        ],
        providerPolygon
    );
    
    const balance = await wrappedToken.balanceOf(user);
    console.log("   Баланс wTKN1:", ethers.formatEther(balance));
    
    if (balance < amount) {
        console.log("   ❌ ПРОБЛЕМА: Недостатньо wTKN1!");
        console.log(`   Потрібно: ${ethers.formatEther(amount)}`);
        console.log(`   Є: ${ethers.formatEther(balance)}`);
        return;
    } else {
        console.log("   ✅ Баланс достатній");
    }
    
    // 2. Перевір чи BridgeMintBurn має BRIDGE_ROLE
    console.log("\n2️⃣ Перевірка дозволів контракту...");
    const wrappedTokenWithRole = new ethers.Contract(
        wrappedTokenAddress,
        ["function hasRole(bytes32,address) view returns (bool)"],
        providerPolygon
    );
    
    const BRIDGE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BRIDGE_ROLE"));
    const hasRole = await wrappedTokenWithRole.hasRole(BRIDGE_ROLE, bridgeAddress);
    
    console.log("   BridgeMintBurn має BRIDGE_ROLE:", hasRole);
    
    if (!hasRole) {
        console.log("   ❌ ПРОБЛЕМА: BridgeMintBurn НЕ має BRIDGE_ROLE!");
        console.log("   Виправлення: npx hardhat run scripts/setup-bridge.js --network polygonAmoy");
        return;
    } else {
        console.log("   ✅ Дозволи правильні");
    }
    
    // 3. Перевір MATIC баланс
    console.log("\n3️⃣ Перевірка балансу MATIC для газу...");
    const maticBalance = await providerPolygon.getBalance(user);
    console.log("   MATIC баланс:", ethers.formatEther(maticBalance));
    
    if (maticBalance < ethers.parseEther("0.01")) {
        console.log("   ⚠️  УВАГА: Низький MATIC баланс!");
        console.log("   Отримай MATIC з фосету: https://faucet.polygon.technology/");
    } else {
        console.log("   ✅ MATIC достатньо");
    }
    
    // 4. Спробуй симулювати транзакцію
    console.log("\n4️⃣ Симуляція транзакції withdraw...");
    const bridge = new ethers.Contract(
        bridgeAddress,
        ["function withdraw(uint256) external"],
        providerPolygon
    );
    
    try {
        const gasEstimate = await bridge.withdraw.estimateGas(amount, { from: user });
        console.log("   ✅ Транзакція пройде! Оцінений газ:", gasEstimate.toString());
    } catch (error) {
        console.log("   ❌ ПРОБЛЕМА: Транзакція не пройде!");
        console.log("   Причина:", error.reason || error.message);
        
        if (error.data) {
            console.log("   Error data:", error.data);
        }
        
        // Спробуй декодувати помилку
        if (error.reason) {
            console.log("\n   💡 Можлива причина:", error.reason);
        }
    }
    
    // 5. Перевір останні події
    console.log("\n5️⃣ Перевірка останніх подій користувача...");
    const bridgeWithEvents = new ethers.Contract(
        bridgeAddress,
        [
            "event WithdrawIntent(address indexed user, uint256 amount, uint256 indexed withdrawNonce)",
            "event WrappedMinted(address indexed to, uint256 amount, uint256 indexed depositNonce)"
        ],
        providerPolygon
    );
    
    const mintEvents = await bridgeWithEvents.queryFilter(
        bridgeWithEvents.filters.WrappedMinted(user),
        -1000
    );
    const withdrawEvents = await bridgeWithEvents.queryFilter(
        bridgeWithEvents.filters.WithdrawIntent(user),
        -1000
    );
    
    console.log(`   Останніх mint: ${mintEvents.length}`);
    console.log(`   Останніх withdraw: ${withdrawEvents.length}`);
    
    if (mintEvents.length > 0) {
        const lastMint = mintEvents[mintEvents.length - 1];
        console.log(`   Останній mint: ${ethers.formatEther(lastMint.args.amount)} wTKN1 (block ${lastMint.blockNumber})`);
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("📊 ВИСНОВОК");
    console.log("=".repeat(60));
}

diagnose()
    .then(() => console.log("\n✅ Діагностика завершена\n"))
    .catch((error) => {
        console.error("\n❌ Помилка діагностики:", error);
        process.exit(1);
    });
    
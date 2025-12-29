// 🧩 встав адресу свого контракту (із Hardhat deploy)
const contractAddress = "0x54545602a641E3be66913A124a761cCAb41db6Fc";

// 🔍 встав ABI (лише частину, без debug.json)
const abi = [
  {
    "inputs":[
      {"internalType":"address","name":"_freelancer","type":"address"},
      {"internalType":"uint256","name":"durationTime","type":"uint256"}
    ],
    "name":"createDeal",
    "outputs":[],
    "stateMutability":"payable",
    "type":"function"
  },
  {
    "inputs":[{"internalType":"uint256","name":"_currentId","type":"uint256"}],
    "name":"approveWork",
    "outputs":[],
    "stateMutability":"nonpayable",
    "type":"function"
  },
  {
    "inputs":[{"internalType":"uint256","name":"_currentId","type":"uint256"}],
    "name":"releasePayment",
    "outputs":[],
    "stateMutability":"nonpayable",
    "type":"function"
  },
  {
    "inputs":[{"internalType":"uint256","name":"_currentId","type":"uint256"}],
    "name":"cancelDeal",
    "outputs":[],
    "stateMutability":"nonpayable",
    "type":"function"
  }
];

let provider;
let signer;
let contract;

// 🔗 підключення MetaMask
document.getElementById("connectButton").addEventListener("click", async () => {
  if (typeof window.ethereum !== "undefined") {
    await ethereum.request({ method: "eth_requestAccounts" });
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    contract = new ethers.Contract(contractAddress, abi, signer);
    const account = await signer.getAddress();
    document.getElementById("account").innerText = `Connected: ${account}`;
    alert("✅ MetaMask connected!");
  } else {
    alert("MetaMask not detected. Please install it.");
  }
});

// 🟢 Create Deal
document.getElementById("createDealButton").addEventListener("click", async () => {
  const freelancer = document.getElementById("freelancerAddress").value;
  const duration = document.getElementById("duration").value;
  const amount = document.getElementById("amount").value;
  const valueInWei = ethers.parseEther(amount);

  const tx = await contract.createDeal(freelancer, duration, { value: valueInWei });
  await tx.wait();
  alert("✅ Deal created successfully!");
});

// 🟡 Approve Work
document.getElementById("approveButton").addEventListener("click", async () => {
  const id = document.getElementById("dealIdApprove").value;
  const tx = await contract.approveWork(id);
  await tx.wait();
  alert("👍 Work approved!");
});

//  Release Payment
document.getElementById("releaseButton").addEventListener("click", async () => {
  const id = document.getElementById("dealIdRelease").value;
  const tx = await contract.releasePayment(id);
  await tx.wait();
  alert("💰 Payment released to freelancer!");
});

//  Cancel Deal
document.getElementById("cancelButton").addEventListener("click", async () => {
  const id = document.getElementById("dealIdCancel").value;
  const tx = await contract.cancelDeal(id);
  await tx.wait();
  alert("❌ Deal cancelled and funds returned!");
});
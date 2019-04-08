const Web3 = require("Web3");
let provider = new Web3.providers.HttpProvider(`https://ropsten.infura.io/v3/${process.env.TOKEN}`);
let web3 = new Web3(provider);

const solc = require('solc');

const EthereumTx = require('ethereumjs-tx');
const privateKey = Buffer.from('90539C2D6AC3077AD43CDE51818FB1AB5B7EC828B59385E3CA89E9AD68C51EFA', 'hex');

const from = '0xad7c03c862393E53510F736178bB93bFD23728d8';

let gasPriceMultiplier = process.env.GPM || 1;
let gasLimitMultiplier = process.env.GLM || 1;

let code = `pragma solidity ^0.5.1;
contract Application {
    constructor() public {}
    enum Assets {
        ATest
    }
    Assets _test = Assets.ATest;

    function test (
        string memory assetId, /* parameter needed for linking assets and transactions */
        string memory p1, /* optional parameter */
        string memory p2, /* optional parameter */
        string memory p3)   /* optional parameter */
    public {}
}`;

let input = {
    language: "Solidity",
    sources: {
        'contract.sol': {
            content: code
        }
    },
    settings: {
        optimizer: {
            enabled: true,
            runs: 200
        },
        outputSelection: {
            '*': {
                '*': ['*']
            }
        }
    }
};

async function main() {
    // Compile the contract
    let output = JSON.parse(solc.compileStandardWrapper(JSON.stringify(input)));
    let compiled = output.contracts['contract.sol'].Application;
    var bc = compiled.evm.bytecode.object;
    var abi = compiled.abi;

    //Grab gas and nonce values
    let gasPrice = await web3.eth.getGasPrice();
    gasPrice = web3.utils.toHex(gasPrice*gasPriceMultiplier);

    let nonce = web3.utils.toHex(await web3.eth.getTransactionCount(from));
    console.log('Using Nonce', nonce);

    const latestBlock = await web3.eth.getBlock("latest");
    const gasLimit = web3.utils.toHex(latestBlock.gasLimit*gasLimitMultiplier);

    //Build the transaction
    const contract = new web3.eth.Contract(abi, from, {
        data: '0x' + bc,
        gas: '0x6208', //we get a better one later
        gasPrice: gasPrice
    });

    let txn = contract.deploy({data: '0x'+bc, arguments: []});

    let rawTxn = {
        from: from,
        data: web3.utils.toHex(await txn.encodeABI()),
        gasPrice:gasPrice,
        nonce: nonce,
        value:'0x00'
    };

    //Test on the node, but don't send to the blockchain
    let ret = await web3.eth.call(rawTxn);
    console.log('Call ret', ret);

    rawTxn.gasLimit= gasLimit;

    //Sign the transaction - normally this part happens on the client, and the signed txn gets sent back to us.
    const tx = new EthereumTx(rawTxn);
    tx.sign(privateKey);
    const serializedTx = '0x' + tx.serialize().toString('hex');
    console.log('Serialized and Signed TXN', serializedTx);

    //Send the signed transaction
    web3.eth.sendSignedTransaction(serializedTx)
        .on('transactionHash', (hash)=>{
            console.log('Hash: ', hash);
            //This gets called
        }).on('error', (error, receipt)=>{
            console.error(error, receipt);
            //This does not get called
        }).on('confirmation',(conNum, receipt)=>{
            console.log(`Got confirmation #${conNum}`, receipt);
            //This gets called
        }).on('receipt',( receipt)=>{
            console.log('Got receipt', receipt);
            //This does not get called
        });
}

if(require.main === module){
    main();
}

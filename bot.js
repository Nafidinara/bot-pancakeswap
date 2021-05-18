import ethers from 'ethers';
import express from 'express';
import chalk from 'chalk';

const app = express();

const data = {
  WBNB: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', //wbnb 

  to_PURCHASE: '0xe9e7cea3dedca5984780bafc599bd69add087d56',  // token to purchase = BUSD for test 0xe9e7cea3dedca5984780bafc599bd69add087d56

  factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',  //PancakeSwap V2 factory

  router: '0x10ED43C718714eb63d5aA57B78B54704E256024E', //PancakeSwap V2 router

  recipient: '0x1857178c69793e6e5c9bB619F11fcef65Fb78bC1', //your wallet address,

  AMOUNT_OF_WBNB : '0.004',

  Slippage : '5', //in Percentage

  gasPrice : '5', //in gwei
  
  gasLimit : '345684', //at least 21000

  minBnb : 2 //min liquidity added
}

let initialLiquidityDetected = false;
let jmlBnb = 0;
let listenOnPairCreated = true; //false if you wont to check

const bscMainnetUrl = 'https://bsc-dataseed1.defibit.io/' //https://bsc-dataseed1.defibit.io/ https://bsc-dataseed.binance.org/
const mnemonic = '' //your memonic;
const tokenIn = data.WBNB;
const tokenOut = data.to_PURCHASE;
const provider = new ethers.providers.JsonRpcProvider(bscMainnetUrl)
const wallet = new ethers.Wallet(mnemonic);
const account = wallet.connect(provider);


const factory = new ethers.Contract(
  data.factory,
  [
    'event PairCreated(address indexed token0, address indexed token1, address pair, uint)',
    'function getPair(address tokenA, address tokenB) external view returns (address pair)'
  ],
  account
);

const router = new ethers.Contract(
  data.router,
  [
    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
  ],
  account
);

const erc = new ethers.Contract(
  data.WBNB,
  [{"constant": true,"inputs": [{"name": "_owner","type": "address"}],"name": "balanceOf","outputs": [{"name": "balance","type": "uint256"}],"payable": false,"type": "function"}],
  account
);  

const run = async () => {
  // check if liquidity added

  if(listenOnPairCreated === true){
    factory.on('PairCreated', async (token0, token1, pairAddress) => {
      console.log('Pair Created...')
    if(token0 === data.WBNB && token1 === data.to_PURCHASE) {
      tokenIn = token0;
      tokenOut = token1;
    }
  
    if(token1 == data.WBNB && token0 === data.to_PURCHASE) {
      tokenIn = token1;
      tokenOut = token0;
    }
  
    if(typeof tokenIn === 'undefined') {
      return 'udefined token';
    }
  
    await checkLiq();
  
    });
  }else{
    await checkLiq();
  }
    
}

  let checkLiq = async() => {
    const pairAddressx = await factory.getPair(tokenIn, tokenOut);
    console.log(chalk.blue(`pairAddress: ${pairAddressx}`));
    if (pairAddressx !== null && pairAddressx !== undefined) {
      // console.log("pairAddress.toString().indexOf('0x0000000000000')", pairAddress.toString().indexOf('0x0000000000000'));
      if (pairAddressx.toString().indexOf('0x0000000000000') > -1) {
        console.log(chalk.red(`pairAddress ${pairAddressx} not detected. Restart me!`));
        await run();
      }
    }
    const pairBNBvalue = await erc.balanceOf(pairAddressx); 
    jmlBnb = ethers.utils.formatEther(pairBNBvalue);
    console.log(`value BNB : ${jmlBnb}`);
  
    if(jmlBnb > data.minBnb){
      await buyAction();
    }
    else{
        initialLiquidityDetected = false;
        console.log(' run agaiin...');
        run();
      }
  }

  let buyAction = async() => {
    if(initialLiquidityDetected === true) {
      console.log('tidak beli');
        return null;
    }

    
    console.log('beli');
    // return;
    initialLiquidityDetected = true;
      // return 'ok beli';
   //We buy x amount of the new token for our wbnb
   const amountIn = ethers.utils.parseUnits(`${data.AMOUNT_OF_WBNB}`, 'ether');
   const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
  
   //Our execution price will be a bit different, we need some flexbility
   const amountOutMin = amounts[1].sub(amounts[1].div(`${data.Slippage}`)); 

   console.log(
    chalk.green.inverse(`Liquidity Addition Detected\n`)
     +
     `Buying Token
     =================
     tokenIn: ${amountIn.toString()} ${tokenIn} (WBNB)
     tokenOut: ${amountOutMin.toString()} ${tokenOut}
   `);
  
   console.log('Processing Transaction.....');
   console.log(chalk.yellow(`amountIn: ${amountIn}`));
   console.log(chalk.yellow(`amountOutMin: ${amountOutMin}`));
   console.log(chalk.yellow(`tokenIn: ${tokenIn}`));
   console.log(chalk.yellow(`tokenOut: ${tokenOut}`));
   console.log(chalk.yellow(`data.recipient: ${data.recipient}`));
   console.log(chalk.yellow(`data.gasLimit: ${data.gasLimit}`));
   console.log(chalk.yellow(`data.gasPrice: ${ethers.utils.parseUnits(`${data.gasPrice}`, 'gwei')}`));
  
   const tx = await router.swapExactTokensForTokens(
     amountIn,
     amountOutMin,
     [tokenIn, tokenOut],
     data.recipient,
     Date.now() + 1000 * 60 * 10, //10 minutes
     {
       'gasLimit': data.gasLimit,
       'gasPrice': ethers.utils.parseUnits(`${data.gasPrice}`, 'gwei')
   });
  
   const receipt = await tx.wait(); 
   console.log('Transaction receipt');
   console.log(receipt);
  }

run();

const PORT = 5000;

app.listen(PORT, (console.log(chalk.yellow(`Listening for Liquidity Addition to token ${data.to_PURCHASE}`))));

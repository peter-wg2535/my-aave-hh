const { ethers, getNamedAccounts, network } = require("hardhat")
const { BigNumber } = require("@ethersproject/bignumber")
const { networkConfig } = require("../helper-hardhat-config")
const readline = require("readline")

const AMOUNT = ethers.utils.parseEther("1")

const underlying_aseet = "WETH"
const operation = "get-data"

async function main() {
    console.log("Welcome AAVE: Borrowing/Lending on Hardhat Framework")

    const { deployer } = await getNamedAccounts()
    const lendingPool = await getLendingPool(deployer)

    // 1. get weth or return
    if (operation == "get-weth") await getWeth(AMOUNT)
    else if (operation == "return-weth") await returnWeth(AMOUNT)
    // 3.approve amount and  deposite weth to aave lending pool
    else if (operation == "deposite") {
        const wethTokenAddress = networkConfig[network.config.chainId].wethToken
        await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, deployer)
        console.log("Deposite WETH to pool")
        //https://docs.aave.com/developers/v/2.0/the-core-protocol/lendingpool#deposit
        const tx_deps_weth = await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0)
        //console.log(tx_deps_weth)
        console.log("Deposited succesfuflly")
    } else if (operation == "borrow") {
        // Getting your borrowing stats
        console.log("Before Borrow The below are borrow user data of " + underlying_aseet)
        let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(lendingPool, deployer)
        const daiPrice = await getDaiPrice()
        //const ethPrice = await getETHPrice()

        const amountDaiAllowedToBorrow = availableBorrowsETH.toString() * (1 / daiPrice.toNumber())
        console.log("You can borrow " + amountDaiAllowedToBorrow.toString() + " DAI")

        const percent_x = 0.5
        const amountDaiToBorrow = amountDaiAllowedToBorrow * percent_x
        console.log(
            "You want to borrow " +
                amountDaiToBorrow.toString() +
                " DAI (" +
                percent_x +
                " % of " +
                amountDaiAllowedToBorrow +
                ")"
        )

        const amountDaiToBorrow_In_Wei = ethers.utils.parseEther(amountDaiToBorrow.toString())
        await borrowDai(
            networkConfig[network.config.chainId].daiToken,
            lendingPool,
            amountDaiToBorrow_In_Wei,
            deployer
        )

        console.log(
            "After Borrow Or Before Repay The below are borrow user data of " + underlying_aseet
        )
        await getBorrowUserData(lendingPool, deployer)
    } else if (operation == "repay") {
        const amountDaiToRepay= 765.45
        const amountDaiToRepay_In_Wei = ethers.utils.parseEther(amountDaiToRepay.toString())
        await repay(
            amountDaiToRepay_In_Wei ,
            networkConfig[network.config.chainId].daiToken,
            lendingPool,
            deployer
        )
        console.log("After Repay The below are borrow user data of " + underlying_aseet)
        await getBorrowUserData(lendingPool, deployer)
    }
    else if (operation == "get-data") {
        await getBorrowUserData(lendingPool, deployer)
    }
}
async function getBorrowUserData(lendingPool, account) {
    //https://docs.aave.com/developers/v/2.0/the-core-protocol/lendingpool#getuseraccountdata
    const {
        totalCollateralETH,
        totalDebtETH,
        availableBorrowsETH,
        currentLiquidationThreshold,
        ltv,
        healthFactor
    } = await lendingPool.getUserAccountData(account)

    console.log(
        "totalCollateral = " +
            ethers.utils.formatEther(totalCollateralETH) +
            "  worth of  assert deposited."
    )
    console.log(
        "totalDebt = " + ethers.utils.formatEther(totalDebtETH) + "  worth of  assert deposited."
    )
    console.log(
        "availableBorrows = " +
            ethers.utils.formatEther(availableBorrowsETH) +
            "  worth of assert deposited."
    )
    console.log("currentLiquidationThreshold %= " + currentLiquidationThreshold / 100)
    console.log("ltv % = " + ltv / 100 + " worth.")
    console.log("healthFactor = " + Number(ethers.utils.formatEther(healthFactor)).toFixed(2))
    return { availableBorrowsETH, totalDebtETH }
}
async function repay(amount, daiAddress, lendingPool, account) {
    await approveErc20(daiAddress, lendingPool.address, amount, account)
    const repayTx = await lendingPool.repay(daiAddress, amount, 1, account)
    await repayTx.wait(1)
    console.log("Repaid!")
}

async function borrowDai(daiAddress, lendingPool, amountDaiToBorrow, account) {
    const borrowTx = await lendingPool.borrow(daiAddress, amountDaiToBorrow, 1, 0, account)
    await borrowTx.wait(1)
    console.log("You've borrowed!")
}

async function getDaiPrice() {
    const daiEthPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        networkConfig[network.config.chainId].daiEthPriceFeed
    )
    const price = (await daiEthPriceFeed.latestRoundData())[1]
    console.log("The DAI/ETH price is " + ethers.utils.formatEther(price))
    return price
}
async function getETHPrice() {
    const ethPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        networkConfig[network.config.chainId].ethUsdPriceFeed
    )
    const decimal = await ethPriceFeed.decimals()
    const price = (await ethPriceFeed.latestRoundData())[1]
    const price_on_decimal = price / Math.pow(10, decimal)
    console.log("The ETH/USD price is " + price_on_decimal)
    return price
}

async function approveErc20(erc20Address, spenderAddress, amount, signer) {
    const erc20Token = await ethers.getContractAt("IERC20", erc20Address, signer)
    txResponse = await erc20Token.approve(spenderAddress, amount)
    await txResponse.wait(1)
    console.log("Approved!")
}

async function getLendingPool(account) {
    const lendingPoolAddressesProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        networkConfig[network.config.chainId].lendingPoolAddressesProvider,
        account
    )
    const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()
    const lendingPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, account)
    //console.log("LendingPool Address : " + lendingPoolAddress)
    return lendingPool
}
async function getWeth(amount) {
    const { deployer } = await getNamedAccounts()
    const iWeth = await ethers.getContractAt(
        "IWeth",
        networkConfig[network.config.chainId].wethToken,
        deployer
    )

    let eth_bal = await iWeth.provider.getBalance(deployer)
    console.log("Before deposit ETH to WETH" + ethers.utils.formatEther(eth_bal) + " ETH")

    const txResponse = await iWeth.deposit({ value: amount })
    await txResponse.wait(1)

    const wethBalance = await iWeth.balanceOf(deployer)
    console.log("Got " + ethers.utils.formatEther(wethBalance.toString()) + " WETH")

    eth_bal = await iWeth.provider.getBalance(deployer)
    console.log("After that " + ethers.utils.formatEther(eth_bal) + " ETH")
}
async function returnWeth(amount) {
    const { deployer } = await getNamedAccounts()
    const iWeth = await ethers.getContractAt(
        "IWeth",
        networkConfig[network.config.chainId].wethToken,
        deployer
    )

    let eth_bal = await iWeth.provider.getBalance(deployer)
    console.log("Before return WETH to ETH " + ethers.utils.formatEther(eth_bal) + " ETH")

    const txResponse = await iWeth.withdraw(amount)
    await txResponse.wait(1)
    const wethBalance = await iWeth.balanceOf(deployer)
    console.log("Return " + ethers.utils.formatEther(wethBalance.toString()) + " WETH")

    eth_bal = await iWeth.provider.getBalance(deployer)
    console.log("After that " + ethers.utils.formatEther(eth_bal) + " ETH")
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })

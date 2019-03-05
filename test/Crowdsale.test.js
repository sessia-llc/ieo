const {BN, balance, ether, should, shouldFail, time} = require('openzeppelin-test-helpers');

const KicksCrowdsale = artifacts.require('KicksCrowdsale');
const KicksToken = artifacts.require('KicksToken');

contract('KicksCrowdsale', function ([deployer, founder, manualSeller, rateSetter, investor, investor2]) {

    let kickCap, kickMinPay, kickPurchased,
        rateEthUsd, rateUsdEth, rateKickUsd, rateUsdKick,
        bonus20capBoundary, bonus10capBoundary;


    before(async function () {
        // Advance to the next block to correctly read time in the solidity "now" function interpreted by ganache
        await time.advanceBlock();
    });


    beforeEach(async function () {
        this.openingTime = (await time.latest()).add(time.duration.weeks(1));
        this.closingTime = this.openingTime.add(time.duration.weeks(1));
        this.afterClosingTime = this.closingTime.add(time.duration.seconds(1));

        this.token = await KicksToken.new(founder, {from: founder});
        this.crowdsale = await KicksCrowdsale.new(
            new BN(1), // not used, calculated based on _rateEthUsd
            this.token.address, // the kick token address
            founder, // accumulation eth address
            founder, // kick storage address
            manualSeller, // can sell tokens
            rateSetter, // can change eth rate
            this.openingTime, // crowdsale opening time
            this.closingTime, // crowdsale closing time
            {from: deployer}
        );

        kickCap = await this.crowdsale.kickCap(); // 50M in usd
        kickMinPay = await this.crowdsale.kickMinPay();
        kickPurchased = await this.crowdsale.kickPurchased();
        rateEthUsd = await this.crowdsale.rateEthUsd();
        rateUsdEth = await this.crowdsale.rateUsdEth();
        rateKickUsd = await this.crowdsale.rateKickUsd();
        rateUsdKick = await this.crowdsale.rateUsdKick();
        bonus20capBoundary = await this.crowdsale.bonus20capBoundary();
        bonus10capBoundary = await this.crowdsale.bonus10capBoundary();

        this.token.approve(this.crowdsale.address, kickCap, {from: founder});
    });


    it('Initial check', async function () {
        should.exist(this.crowdsale);
        should.exist(this.token);
        (await this.crowdsale.wallet()).should.be.equal(founder);
        (await this.crowdsale.tokenWallet()).should.be.equal(founder);
    });


    it('Time limit', async function () {
        await shouldFail.reverting(this.crowdsale.buyTokens(investor, {value: ether('1'), from: investor}));
        await time.increaseTo(this.openingTime);
        this.crowdsale.buyTokens(investor, {value: ether('10'), from: investor});
        await time.increaseTo(this.afterClosingTime);
        await shouldFail.reverting(this.crowdsale.buyTokens(investor, {value: ether('1'), from: investor}));
    });


    it('Buy', async function () {
        await time.increaseTo(this.openingTime);
        let eth = ether('100');
        let usd = eth.mul(rateEthUsd).div(ether('1'));
        let kick = usd.mul(rateUsdKick).div(ether('1'));
        let bonus = kick.mul(new BN('20')).div(new BN('100'));
        await this.crowdsale.buyTokens(investor, {value: eth, from: investor});
        (await this.token.balanceOf(investor)).should.be.bignumber.equal(kick.add(bonus));
    });


    it('Buy less min', async function () {
        await time.increaseTo(this.openingTime);
        await shouldFail.reverting(this.crowdsale.buyTokens(investor, {value: ether('1'), from: investor}));
    });


    it('Cap has been reached', async function () {
        await time.increaseTo(this.openingTime);
        let kick = kickCap.add(new BN('1'));
        let usd = kick.mul(rateKickUsd).div(ether('1'));
        let eth = usd.mul(rateUsdEth).div(ether('1'));
        await shouldFail.reverting(this.crowdsale.buyTokens(investor, {value: eth, from: investor}));
    });


    it('Cap increment', async function () {
        await time.increaseTo(this.openingTime);
        let eth1 = ether('100');
        let kick1 = eth1.mul(rateEthUsd).div(ether('1'));
        let bonus1 = kick1.mul(new BN('20')).div(new BN('100'));
        await this.crowdsale.buyTokens(investor, {value: eth1, from: investor});
        (await this.crowdsale.kickPurchased()).should.be.bignumber.equal(kick1.add(bonus1));
    });


    it('Manual sell', async function () {
        await shouldFail.reverting(
            this.crowdsale.manualSell(investor, ether('1000'), {from: manualSeller})
        );
        await time.increaseTo(this.openingTime);

        await shouldFail.reverting(
            this.crowdsale.manualSell(investor, ether('1000'), {from: investor})
        );
        await shouldFail.reverting(
            this.crowdsale.manualSell(investor, ether('100'), {from: manualSeller})
        );

        let eth = ether('1000');
        let usd = eth.mul(rateEthUsd).div(ether('1'));
        let kick = usd.mul(rateUsdKick).div(ether('1'));
        let bonus = kick.mul(new BN('20')).div(new BN('100'));
        await this.crowdsale.manualSell(investor, usd, {from: manualSeller});
        (await this.token.balanceOf(investor)).should.be.bignumber.equal(kick.add(bonus));
    });


    it('Bonus check', async function () {
        await time.increaseTo(this.openingTime);

        let eth20 = ether('100');
        let usd20 = eth20.mul(rateEthUsd).div(ether('1'));
        let token20 = usd20.mul(rateUsdKick).div(ether('1'));
        let bonus20 = token20.mul(new BN('20')).div(new BN('100'));
        await this.crowdsale.buyTokens(investor, {value: eth20, from: investor});
        (await this.token.balanceOf(investor)).should.be.bignumber.equal(token20.add(bonus20));

        let token10 = bonus20capBoundary;
        let usd10 = token10.mul(rateKickUsd).div(ether('1'));
        let eth10 = usd10.mul(rateUsdEth).div(ether('1'));
        let bonus10 = token10.mul(new BN('20')).div(new BN('100'));
        await this.crowdsale.buyTokens(investor2, {value: eth10, from: investor2});
        (await this.token.balanceOf(investor2)).should.be.bignumber.equal(token10.add(bonus10));
    });


    it('founder balance', async function () {
        await time.increaseTo(this.openingTime);
        let eth = ether('1000');
        let crowdsale = this.crowdsale;
        (await balance.difference(founder, async function () {
            await crowdsale.buyTokens(investor, {value: eth, from: investor});
        })).should.be.bignumber.equal(eth);
    });

});

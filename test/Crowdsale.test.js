const {BN, balance, ether, should, shouldFail, time} = require('openzeppelin-test-helpers');

const KicksCrowdsale = artifacts.require('KicksCrowdsale');
const KicksToken = artifacts.require('KicksToken');

contract('KicksCrowdsale', function ([deployer, founder, manualSeller, rateSetter, investor, investor2, investor3]) {

    let rate = new BN('93');
    let kickCap = new BN('33333333333333333333333333');
    let kickMinPay = ether('100');
    let kickPurchased = new BN('0');
    let bonus20capBoundary = new BN('666666666666666666666667');
    let bonus10capBoundary = new BN('1333333333333333333333333');

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
            rate, // eth to kick rate
            this.token.address, // the kick token address
            founder, // accumulation eth address
            founder, // kick storage address
            manualSeller, // can sell tokens
            rateSetter, // can change eth rate
            this.openingTime, // crowdsale opening time
            this.closingTime, // crowdsale closing time
            {from: deployer}
        );

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
        let kick = eth.mul(rate);
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
        await shouldFail.reverting(this.crowdsale.buyTokens(investor, {value: ether('500000'), from: investor}));
    });


    it('Cap increment', async function () {
        await time.increaseTo(this.openingTime);

        let eth1 = ether('100');
        await this.crowdsale.buyTokens(investor, {value: eth1, from: investor});

        let eth2 = ether('100');
        await this.crowdsale.buyTokens(investor2, {value: eth2, from: investor2});

        let kick1 = eth1.mul(rate);
        let bonus1 = kick1.mul(new BN('20')).div(new BN('100'));
        let sum1 = kick1.add(bonus1);

        let kick2 = eth2.mul(rate);
        let bonus2 = kick2.mul(new BN('20')).div(new BN('100'));
        let sum2 = kick2.add(bonus2);

        (await this.crowdsale.kickPurchased()).should.be.bignumber.equal(sum1.add(sum2));
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
            this.crowdsale.manualSell(investor, ether('1'), {from: manualSeller})
        );

        let eth = ether('100');
        let kick = eth.mul(rate);
        let bonus = kick.mul(new BN('20')).div(new BN('100'));
        await this.crowdsale.manualSell(investor, eth, {from: manualSeller});
        (await this.token.balanceOf(investor)).should.be.bignumber.equal(kick.add(bonus));
    });


    it('Bonus check', async function () {
        await time.increaseTo(this.openingTime);

        let eth20 = ether('100');
        let kick20 = eth20.mul(rate);
        let bonus20 = kick20.mul(new BN('20')).div(new BN('100'));

        await this.crowdsale.buyTokens(investor, {value: eth20, from: investor});
        (await this.token.balanceOf(investor)).should.be.bignumber.equal(kick20.add(bonus20));

        let eth10 = ether('10907'); // ~ $1.5M
        let kick10 = eth10.mul(rate);
        let bonus10 = kick10.mul(new BN('10')).div(new BN('100'));
        await this.crowdsale.buyTokens(investor2, {value: eth10, from: investor2});
        (await this.token.balanceOf(investor2)).should.be.bignumber.equal(kick10.add(bonus10));

        let eth0 = ether('21813'); // ~ $3M
        let kick0 = eth0.mul(rate);
        await this.crowdsale.buyTokens(investor3, {value: eth0, from: investor3});
        (await this.token.balanceOf(investor3)).should.be.bignumber.equal(kick0);
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

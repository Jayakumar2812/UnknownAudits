import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers,testUtils } from "hardhat";


describe("Mock Gov", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deploymentstate() {

      // Contracts are deployed using the first signer/account by default
      const [owner, addr1,addr2] = await ethers.getSigners();
      const one_eth =  ethers.utils.parseEther("1");
      // const Gov = await ethers.getContractFactory("Recommended");
      const Gov = await ethers.getContractFactory("MockGovToken");
      const gov = await Gov.deploy();
      return { gov, owner, addr1,addr2,one_eth };
    }

    // describe('metadata', () => {

    // it('has given name', async () => {
    //     const {gov} = await loadFixture(deploymentstate);
    //     expect(await gov.name()).to.equal("MockGovToken","Contract name mismatch");
    // });
    
    // it('has given symbol', async () => {
    //     const {gov} = await loadFixture(deploymentstate);
    //         expect(await gov.symbol()).to.equal("MGToken","Contract symbol mismatch");
    // });
    // });

    describe('nonces and getPriorVotes', () => {

    it('initial nonce is 0', async function () {
        const {gov, owner} = await loadFixture(deploymentstate);
        expect(await gov.nonces(owner.address)).to.equal(0,"Nonce of owner address at start is not zero");
    });

    it('reverts if block number >= current block', async () => {
        const {gov, owner} = await loadFixture(deploymentstate);
        const {block} = testUtils;
        const latestBlockNumber = await block.latestBlockNumber();
        await expect(gov.getPriorVotes(owner.address,latestBlockNumber +1)).to.be.revertedWith("MGToken::getPriorVotes: not yet determined");
    });
  
      it('returns 0 if there are no checkpoints', async () => {
        const {gov, owner} = await loadFixture(deploymentstate);
        const {block} = testUtils;
        const latestBlockNumber = await block.latestBlockNumber();
        expect(await gov.getPriorVotes(owner.address,latestBlockNumber -1)).to.equal(0,"PriorVotes of owner address at penultimate block is not matching");
      });
  
      it('returns the latest block if >= last checkpoint block', async () => {
        const {gov, owner,one_eth} = await loadFixture(deploymentstate);
        const {block} = testUtils;

        const latestBlockNumber = await block.latestBlockNumber();

        const delegate_tx = await gov.delegate(owner.address);
        await delegate_tx.wait();

        const mint_tx = await gov["mint(address,uint256)"](owner.address,one_eth);
        await mint_tx.wait();

        await block.advance();
        
        expect(await gov.getPriorVotes(owner.address,1)).to.equal(0,"PriorVotes of owner address at start block is not matching");
        expect(await gov.getPriorVotes(owner.address,latestBlockNumber +2)).to.equal(one_eth,"PriorVotes of owner address at mint block is not matching");
      });
  

    it('recent checkpoints', async function () {
        const {gov, owner, one_eth  } = await loadFixture(deploymentstate);

        await gov.delegate(owner.address);
        for (let i = 0; i < 6; i++) {
          await gov["mint(address,uint256)"](owner.address, one_eth);
        }

        const { block } = testUtils;
        
        const blocknumber = await block.latestBlockNumber()
        expect(await gov.numCheckpoints(owner.address)).to.equal(6,"numCheckpoints of owner address after mints is not matching");
        // recent
        expect(await gov.getPriorVotes(owner.address, blocknumber - 1)).to.equal(one_eth.mul(5),"PriorVotes of owner address at penultimate block is not matching");
        // non-recent
        expect(await gov.getPriorVotes(owner.address, blocknumber - 6)).to.equal(0,"PriorVotes of owner address at initial block is not matching");
      });
    });

    describe('numCheckpoints', () => {

        it("Does not increase if the amount is zero", async () => {
            const {gov, owner, one_eth,addr1  } = await loadFixture(deploymentstate);

            const delegate_tx = gov.delegate(owner.address);
            await (await delegate_tx).wait();

            expect(await gov.numCheckpoints(owner.address)).to.equal(0,"numCheckpoints of owner address from start is not matching");

            const mint_tx = await gov["mint(address,uint256)"](owner.address,one_eth);
            await mint_tx.wait();

            expect(await gov.numCheckpoints(owner.address)).to.equal(1,"numCheckpoints of owner address after mint is not matching");
 
            const transfer_tx = await gov.transfer(addr1.address,0);
            await transfer_tx.wait();

            expect(await gov.numCheckpoints(owner.address)).to.equal(1,"numCheckpoints of owner address after transfer is not matching");

        });

        it('returns the number of checkpoints for a delegate : Fails since votes are not tracked', async () => {
            const {gov, owner, one_eth,addr1  } = await loadFixture(deploymentstate);

            const delegate_tx = gov.delegate(owner.address);
            await (await delegate_tx).wait();

            expect(await gov.numCheckpoints(owner.address)).to.equal(0,"numCheckpoints of owner address from start is not matching");

            const mint_tx = await gov["mint(address,uint256)"](owner.address,one_eth);
            await mint_tx.wait();

            expect(await gov.numCheckpoints(owner.address)).to.equal(1,"numCheckpoints of owner address after mint is not matching");

            const transfer_tx = await gov.transfer(addr1.address,1);
            await transfer_tx.wait();

            expect(await gov.numCheckpoints(owner.address)).to.equal(2,"numCheckpoints of owner address after transfer is not matching");
            // expect(await gov.numCheckpoints(owner.address)).to.not.equal(2);

 

        });
    
        it('does not add more than one checkpoint in a block', async () => {
            const {gov, owner, one_eth,addr1  } = await loadFixture(deploymentstate);

            const mint_tx = await gov.connect(owner)["mint(address,uint256)"](owner.address,one_eth);
            await mint_tx.wait();

            expect(await gov.numCheckpoints(addr1.address)).to.equal(0,"numCheckpoints of addr1 address from start is not matching");

            const { block } = testUtils;
            const latestBlockNumber = await block.latestBlockNumber();

            const delegate_addr1_tx = await gov.connect(addr1).delegate(addr1.address);
            await delegate_addr1_tx.wait();

            await block.setAutomine(false);

            const delegate_tx = await gov.connect(owner).delegate(addr1.address);

            const mint2_tx = await gov.connect(owner)["mint(address,uint256)"](addr1.address,one_eth);
            const mint3_tx = await gov.connect(owner)["mint(address,uint256)"](addr1.address,one_eth);
      
            await block.setAutomine(true);

            await block.advance();
            await delegate_tx.wait();
            await mint2_tx.wait();
            await mint3_tx.wait();

            expect(await gov.numCheckpoints(addr1.address)).to.equal(1,"numCheckpoints of addr1 address after batch transactions is not matching");

            const res1 = await gov.checkpoints(addr1.address,0);
            expect(res1[0]).to.equal(latestBlockNumber+2,"Block number after batch transactions is not matching"); 
            expect(res1[1]).to.equal(one_eth.mul(3),"Balance of addr1 address after batch transactions is not matching"); 


            const res2 = await gov.checkpoints(addr1.address,1);
            expect(res2[0]).to.equal(0,"Block number before transfer3 is not matching"); 
            expect(res2[1]).to.equal(0,"Balance of addr1 address before transfer3 is not matching");
            
            
            const res3 = await gov.checkpoints(addr1.address,2);
            expect(res3[0]).to.equal(0,"Block number before transfer3 is not matching"); 
            expect(res3[1]).to.equal(0,"Balance of addr1 address before transfer3 is not matching");
      
            const transfer3_tx = await gov.connect(owner)["mint(address,uint256)"](addr1.address,one_eth);
            await transfer3_tx.wait();

            expect(await gov.numCheckpoints(addr1.address)).to.equal(2,"numCheckpoints of addr1 after transfer3 is not matching");

            const transfer3_block = transfer3_tx.blockNumber

            const res4 = await gov.checkpoints(addr1.address,1);
            expect(res4[0]).to.equal(transfer3_block,"Block number after transfer3 is not matching"); 
            expect(res4[1]).to.equal(one_eth.mul(4),"Balance of addr1 address after transfer3 is not matching");
        });
      });

      describe('delegateBySig', () => {

        it('reverts if the signatory is invalid', async () => {
            const {gov, owner, one_eth ,addr1 } = await loadFixture(deploymentstate);
            await  expect (gov.delegateBySig(
                addr1.address,
                0,
                10e9,
                0,
                "0x2ede4c2b328bf8db5cf984a0ff6342e1264de3a70afca5365b5d750f61e49349",
                "0x2ede4c2b328bf8db5cf984a0ff6342e1264de3a70afca5365b5d750f61e49349")).to.be.revertedWith('MGToken::delegateBySig: invalid signature')
          })

          it('reverts if the nonce is bad ', async () => {
            const {gov, owner, one_eth ,addr1 } = await loadFixture(deploymentstate);
            const name = await gov.name();
            const domain = {
                name: name,
                chainId: 31337,
                verifyingContract: gov.address
            };
            const types = {
            Delegation: [
              { name: 'delegatee', type: 'address' },
              { name: 'nonce', type: 'uint256' },
              { name: 'expiry', type: 'uint256' }
            ]
            };
            const value = {
                delegatee:addr1.address,
                nonce:1,
                expiry:10e9
            }
            const flatSig = await owner._signTypedData(domain, types, value)
            let sig = ethers.utils.splitSignature(flatSig);

            await expect (gov.delegateBySig(addr1.address,1,10e9,sig.v,sig.r,sig.s)).to.be.revertedWith("MGToken::delegateBySig: invalid nonce")
            
          });
          it('reverts if the signature has expired', async () => {
                const {gov, owner, one_eth ,addr1 } = await loadFixture(deploymentstate);
                const name = await gov.name();
                const domain = {
                    name: name,
                    chainId: 31337,
                    verifyingContract: gov.address
                };
                const types = {
                Delegation: [
                  { name: 'delegatee', type: 'address' },
                  { name: 'nonce', type: 'uint256' },
                  { name: 'expiry', type: 'uint256' }
                ]
                };
                const value = {
                    delegatee:addr1.address,
                    nonce:0,
                    expiry:0
                }
                const flatSig = await owner._signTypedData(domain, types, value)
                let sig = ethers.utils.splitSignature(flatSig);
    
                await expect (gov.delegateBySig(addr1.address,0,0,sig.v,sig.r,sig.s)).to.be.revertedWith("MGToken::delegateBySig: signature expired")
                
              });

        it('delegates on behalf of the signatory if everything is correct', async () => {
            const {gov, owner, one_eth ,addr1 } = await loadFixture(deploymentstate);
            const name = await gov.name();
            const domain = {
                name: name,
                chainId: 31337,
                verifyingContract: gov.address
            };
            const types = {
            Delegation: [
              { name: 'delegatee', type: 'address' },
              { name: 'nonce', type: 'uint256' },
              { name: 'expiry', type: 'uint256' }
            ]
            };
            const value = {
                delegatee:addr1.address,
                nonce:0,
                expiry:10e9
            }
            const flatSig = await owner._signTypedData(domain, types, value)
            let sig = ethers.utils.splitSignature(flatSig);

            const delegateBySig_tx = await gov.delegateBySig(addr1.address,0,10e9,sig.v,sig.r,sig.s)
            await delegateBySig_tx.wait();

            expect(await gov.delegates(owner.address)).to.equal(addr1.address,"delegates address not matching");
        })
        it('should not able to reuse the signature', async () => {
            const {gov, owner, one_eth ,addr1 } = await loadFixture(deploymentstate);
            const name = await gov.name();
            const domain = {
                name: name,
                chainId: 31337,
                verifyingContract: gov.address
            };
            const types = {
            Delegation: [
              { name: 'delegatee', type: 'address' },
              { name: 'nonce', type: 'uint256' },
              { name: 'expiry', type: 'uint256' }
            ]
            };
            const value = {
                delegatee:addr1.address,
                nonce:0,
                expiry:10e9
            }
            const flatSig = await owner._signTypedData(domain, types, value)
            let sig = ethers.utils.splitSignature(flatSig);

            const delegateBySig_tx = await gov.delegateBySig(addr1.address,0,10e9,sig.v,sig.r,sig.s)
            await delegateBySig_tx.wait();

            await expect(gov.delegateBySig(addr1.address,0,10e9,sig.v,sig.r,sig.s)).to.be.revertedWith("MGToken::delegateBySig: invalid nonce")
      })        
    })
    
      describe('mint(address to,uint256 amount) function', () => {

        it('Should be called only owner', async () => {
            const {gov,addr1,one_eth} = await loadFixture(deploymentstate);
            await expect(gov.connect(addr1)["mint(address,uint256)"](addr1.address,one_eth)).to.be.revertedWith("Ownable: caller is not the owner");
        });
        
        it('Owner should be able to call the function and it should increase the balance and votes of owner', async () => {
            const {gov,owner,one_eth} = await loadFixture(deploymentstate);

            const delegate_tx = await gov.delegate(owner.address);
            await delegate_tx.wait();

            const mint_tx = await gov["mint(address,uint256)"](owner.address,one_eth);
            await mint_tx.wait();

            expect(await gov.balanceOf(owner.address)).to.equal(one_eth,"Balances of owner address is not matching");
            expect(await gov.getCurrentVotes(owner.address)).to.equal(one_eth,"Votes of owner address is not matching");

        });
        });
        describe('mint(uint256 amount) function', () => {

            it('Should be called only owner', async () => {
                const {gov,addr1,one_eth} = await loadFixture(deploymentstate);
                await expect(gov.connect(addr1)["mint(uint256)"](one_eth)).to.be.revertedWith("Ownable: caller is not the owner");
            });
            
            it("Owner should be able to call the function and it should increase the balance and votes of owner but it doesn't increase votes", async () => {
                const {gov,owner,one_eth} = await loadFixture(deploymentstate);
    
                const delegate_tx = await gov.delegate(owner.address);
                await delegate_tx.wait();
    
                const mint_tx = await gov["mint(uint256)"](one_eth);
                await mint_tx.wait();
    
                expect(await gov.balanceOf(owner.address)).to.equal(one_eth,"Balances of owner address is not matching");
                expect(await gov.getCurrentVotes(owner.address)).to.equal(one_eth,"Votes of owner address is not matching");
                // expect(await gov.getCurrentVotes(owner.address)).to.equal(0);

    
            });
            });

        describe('Transfer(address to,uint256 amount) function', () => {

                it("Should track the balances and votes but votes aren't tracked", async () => {
                    const {gov,owner,addr1,one_eth} = await loadFixture(deploymentstate);

                    const delegate_tx = await gov.delegate(owner.address);
                    await delegate_tx.wait();

                    const delegate_2tx = await gov.connect(addr1).delegate(addr1.address);
                    await delegate_2tx.wait();
        
                    const mint_tx = await gov["mint(address,uint256)"](owner.address,one_eth);
                    await mint_tx.wait();

                    expect(await gov.balanceOf(owner.address)).to.equal(one_eth,"Balances of owner address is not matching");
                    expect(await gov.getCurrentVotes(owner.address)).to.equal(one_eth,"Votes of owner address is not matching");

                    const trasnfer_tx = await gov.transfer(addr1.address,one_eth);
                    await trasnfer_tx.wait();

                    expect(await gov.balanceOf(owner.address)).to.equal(0,"Balances of owner address is not matching");
                    expect(await gov.getCurrentVotes(owner.address)).to.equal(0,"Votes of owner address is not matching");
                    // expect(await gov.getCurrentVotes(owner.address)).to.equal(one_eth);

                    expect(await gov.balanceOf(addr1.address)).to.equal(one_eth,"Balances of addr1 address is not matching");
                    expect(await gov.getCurrentVotes(addr1.address)).to.equal(one_eth,"Votes of addr1 address is not matching");
                    // expect(await gov.getCurrentVotes(addr1.address)).to.equal(0);

                });
            });
    describe('TransferFrom(address from, address to,uint256 amount) function', () => {

        it("Should track the balances and votes but votes aren't tracked", async () => {
            const {gov,owner,addr1,one_eth} = await loadFixture(deploymentstate);

            const delegate_tx = await gov.delegate(owner.address);
            await delegate_tx.wait();

            const delegate_2tx = await gov.connect(addr1).delegate(addr1.address);
            await delegate_2tx.wait();

            const mint_tx = await gov["mint(address,uint256)"](owner.address,one_eth);
            await mint_tx.wait();

            const allowance_tx = await gov.approve(owner.address,one_eth);
            await allowance_tx.wait();

            expect(await gov.balanceOf(owner.address)).to.equal(one_eth,"Balances of owner address is not matching");
            expect(await gov.getCurrentVotes(owner.address)).to.equal(one_eth,"Votes of owner address is not matching");
            expect(await gov.allowance(owner.address,owner.address)).to.equal(one_eth,"allowance of owner address is not matching");

            const trasnfer_tx = await gov.transferFrom(owner.address,addr1.address,one_eth);
            await trasnfer_tx.wait();

            expect(await gov.balanceOf(owner.address)).to.equal(0,"Balance of owner address is not matching");
            expect(await gov.getCurrentVotes(owner.address)).to.equal(0,"votes of owner address is not matching ");
            // expect(await gov.getCurrentVotes(owner.address)).to.equal(one_eth);


            expect(await gov.balanceOf(addr1.address)).to.equal(one_eth,"Balance of addr1 address is not matching");
            expect(await gov.getCurrentVotes(addr1.address)).to.equal(one_eth,"Votes of addr1 address is not matching");
            // expect(await gov.getCurrentVotes(addr1.address)).to.equal(0);

        });
    });
    describe('burn(adress from, uint256 amount) function', () => {

      it('Burn function should reduce balances and votes ', async () => {
          const {gov,addr1,one_eth,owner} = await loadFixture(deploymentstate);

          const delegate_tx = await gov.delegate(owner.address);
          await delegate_tx.wait();

          const mint_tx = await gov["mint(address,uint256)"](owner.address,one_eth);
          await mint_tx.wait();

          expect(await gov.balanceOf(owner.address)).to.equal(one_eth,"Balances of owner address is not matching");
          expect(await gov.getCurrentVotes(owner.address)).to.equal(one_eth,"Votes of owner address is not matching");

          const burn_tx = await gov.burn(owner.address,one_eth);
          await burn_tx.wait();

          expect(await gov.balanceOf(owner.address)).to.equal(0,"Balances of owner address is not matching");
          expect(await gov.getCurrentVotes(owner.address)).to.equal(0,"Votes of owner address is not matching");
      });
  });
    describe('Events', () => {

        it('Should emit DelegateChanged and DelegateVotesChanged', async () => {
            const {gov,addr1,one_eth,owner} = await loadFixture(deploymentstate);

            const delegate_tx = await gov.delegate(owner.address);
            await delegate_tx.wait();

            expect(gov["mint(address,uint256)"](owner.address,one_eth)).to.emit(gov,"DelegateVotesChanged").withArgs(owner.address,0,one_eth)

            const mint_tx = await gov["mint(address,uint256)"](owner.address,one_eth);
            await mint_tx.wait();

            const delegate2_tx = await gov.connect(addr1).delegate(addr1.address);
            await delegate2_tx.wait();

            await expect((await gov.delegate(addr1.address))).to.emit(gov,"DelegateChanged").withArgs(owner.address,owner.address,addr1.address)
        });
    });
    
})
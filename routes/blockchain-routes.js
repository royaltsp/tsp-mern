const rp = require("request-promise");
const Blockchain = require("../dev/blockchain");
const mongoose = require("mongoose");
const axios = require("axios");
const uuid = require("uuid/v1"); // to create unique id/string
const node_addr = uuid()
  .split("-")
  .join()
  .split(",")
  .join();
const fs = require("fs");

module.exports = app => {
  // console.log(fs.);
  let Securum;

  writeSecurum = async () => {
    await fs.writeFile(
      "./data/node1.json",
      JSON.stringify(Securum.chain),
      err => {
        if (err) console.log(err);
        console.log("Written");
      }
    );
    // console.log(Securum);
  };

  Securum = new Blockchain();
  if (fs.existsSync("./data/node1.json")) {
    Securum.chain = JSON.parse(fs.readFileSync("./data/node1.json"));
  } else {
    writeSecurum();
  }

  app.get("/", function (req, res) {
    res.sendFile("index.html");
  });

  app.get("/blockchain", function (req, res) {
    res.send(Securum);
  });

  app.get("/block-explorer", function (req, res) {
    res.sendFile("../dev/block-explorer/index.html", { root: __dirname });
  });

  app.get("/reset", (req, res) => {
    fs.unlinkSync("./data/node1.json");
    res.send({
      msg: "BlockChain Reseted"
    });
  });

  app.post("/transaction", function (req, res) {
    // console.log(req);
    // res.send(`The Amonunt of Transaction is ${req.body.amount} Securum.`);
    // const block_index = Securum.createNewTransaction(req.body.amount, req.body.sender, req.body.recipient);
    // res.json({ notes: `Transaction will be added in block ${block_index}`});
    console.log(Securum); s
    const new_transaction = req.body;
    const block_index = Securum.addTransactionToPendingTransactions(
      new_transaction
    );
    res.json({ note: `Transaction will be added in block ${block_index}` });
  });
  //to push transaction
  // {
  // 	"amount": 50000,
  // 	"sender": "fshgdfsdyt5657",
  // 	"recipient": "65fGHFd45fgh"
  // }

  app.post("/transaction/broadcast", function (req, res) {
    // if (req.body.sender != "00") {
    //   address_data = Securum.getAddressData(req.body.sender);
    //   if (address_data.addressBalance < req.body.amount) {
    //     res.json({ "note": "Not Sufficient Balance in Sender's Account" });
    //     return;
    //   }
    // }
    // console.log('address_data :', address_data.addressBalance);
    // console.log('req.body.amount :', req.body.amount);

    const new_transaction = Securum.createNewTransaction(
      req.body.amount,
      req.body.sender,
      req.body.recipient
    );
    Securum.addTransactionToPendingTransactions(new_transaction);

    const request_promises = [];
    Securum.network_nodes.forEach(network_node_url => {
      const request_options = {
        uri: network_node_url + "/transaction",
        method: "POST",
        body: new_transaction,
        json: true
      };

      request_promises.push(rp(request_options));
    });

    Promise.all(request_promises)
      .then(data => {
        res.json({
          note: 'Transaction created and broadcast successfully.',
          error: false
        });
      });
    Promise.all(request_promises).then(data => {
      writeSecurum();
      // console.log(Securum);
      res.json({
        note: "Transaction created and broadcast successfully.",
        error: false
      });
    });
  });

  app.get("/mine", function (req, res) {
    const last_block = Securum.getLastBlock();
    const prev_block_hash = last_block["hash"];

    const current_block_data = {
      transactions: Securum.pending_transactions,
      index: last_block["index"] + 1
    };

    const senders = new Array();
    current_block_data.transactions.forEach(transaction => {
      if (transaction.sender != "00" && node_addr != transaction.recipient)
        senders.push({ uid: transaction.sender, amount: transaction.amount });
    });
    console.log("Transaction Senders :", senders);

    senders.forEach(sender => {
      const uid = sender.uid.split("$_$")[1];
      axios
        .post("/update-balance", {
          uid: uid,
          amount: sender.amount
        })
        .then(res => {
          console.log(res.data);
          if (!res.data.error) {
            // console.log(res)
            console.log(sender.uid + " - done");
          } else console.log(sender.uid + " - fail");
        })
        .catch(err => {
          console.error(err);
          throw err;
        });
    });

    const nonce = Securum.proofOfWork(prev_block_hash, current_block_data);
    const current_block_hash = Securum.hashBlock(
      prev_block_hash,
      current_block_data,
      nonce
    ); // get hash for currently adding block

    // // Securum.createNewTransaction(12.5, "00", node_addr); // Reward for miner which is current instance/node as Securum
    // //later blocks are shared in netwrok then make this reward transaction for all nodes given below

    const new_block = Securum.createNewBlock(
      nonce,
      prev_block_hash,
      current_block_hash
    ); // to add current block

    const request_promises = [];
    Securum.network_nodes.forEach(network_node_url => {
      const request_options = {
        uri: network_node_url + "/receive-new-block",
        method: "POST",
        body: { new_block: new_block },
        json: true
      };

      request_promises.push(rp(request_options));
    });

    Promise.all(request_promises)
      .then(data => {
        if (senders.length == 0) senders.push("00");
        senders.forEach(sender => {
          const request_options = {
            uri: Securum.current_node_url + "/transaction/broadcast",
            method: "POST",
            body: {
              amount: 12.5 / senders.length,
              sender: sender,
              recipient: node_addr
            },
            json: true
          };
          request_promises.push(rp(request_options));
        });
        // return rp(request_options);
        return request_promises;
      })
      .then(data => {
        writeSecurum();
        // console.log(Securum);
        res.json({
          note: "New Block Mined and broadcasted Successfully",
          block: new_block
        });
      });
  });

  app.post("/receive-new-block", function (req, res) {
    const new_block = req.body.new_block;
    const last_block = Securum.getLastBlock();
    const is_correct_hash = last_block.hash === new_block.prev_block_hash;
    const is_correct_index = last_block["index"] + 1 === new_block["index"];

    // console.log("hash" + is_correct_hash);
    // console.log("index" + is_correct_index);

    if (is_correct_hash && is_correct_index) {
      Securum.chain.push(new_block);
      Securum.pending_transactions = [];
      res.json({
        note: "New Block received and accepted",
        new_block: new_block
      });
    } else {
      res.json({
        note: "New Block rejected",
        new_block: new_block
      });
    }
  });

  // to post new node
  // {
  // 	"new_node_url": "http://localhost:3005"
  // }

  app.post("/register-and-broadcast-node", function (req, res) {
    const new_node_url = req.body.new_node_url;
    if (Securum.network_nodes.indexOf(new_node_url) == -1)
      Securum.network_nodes.push(new_node_url);

    const reg_nodes_promises = [];
    Securum.network_nodes.forEach(network_node_url => {
      const req_options = {
        uri: network_node_url + "/register-node",
        method: "POST",
        body: { new_node_url: new_node_url },
        json: true
      };

      reg_nodes_promises.push(rp(req_options));
    });

    Promise.all(reg_nodes_promises)
      .then(data => {
        const bulk_register_options = {
          uri: new_node_url + "/register-nodes-bulk",
          method: "POST",
          body: {
            all_network_nodes: [
              ...Securum.network_nodes,
              Securum.current_node_url
            ]
          },
          json: true
        };
        return rp(bulk_register_options);
      })
      .then(data => {
        res.json({ note: "New node registerd with network successfully" });
      });
  });

  app.post("/register-node", function (req, res) {
    const new_node_url = req.body.new_node_url;
    const node_not_already_present =
      Securum.network_nodes.indexOf(new_node_url) == -1;
    const not_current_node = Securum.current_node_url !== new_node_url;
    if (node_not_already_present && not_current_node)
      Securum.network_nodes.push(new_node_url);
    res.json({ note: "New Node registerd successfully with node." });
  });

  app.post("/register-nodes-bulk", function (req, res) {
    const all_network_nodes = req.body.all_network_nodes;
    all_network_nodes.forEach(network_node_url => {
      const node_not_already_present =
        Securum.network_nodes.indexOf(network_node_url) == -1;
      const not_current_node = Securum.current_node_url !== network_node_url;
      if (node_not_already_present && not_current_node)
        Securum.network_nodes.push(network_node_url);
    });
    res.json({ note: "Bulk Registration successful." });
  });

  // to post bulk nodes json
  // {
  // 	"all_network_nodes": [
  // 		"http://localhost:3002",
  // 		"http://localhost:3003",
  // 		"http://localhost:3004",
  // 		"http://localhost:3005"
  // 	]
  // }

  // // consensus
  // app.get('/consensus', function(req, res) {
  // 	const request_promises = [];
  // 	Securum.network_nodes.forEach(network_node_url => {
  // 		const request_options = {
  // 			uri: network_node_url + '/blockchain',
  // 			method: 'GET',
  // 			json: true
  // 		};

  // 		request_promises.push(rp(request_options));
  // 	});

  // 	Promise.all(request_promises)
  // 	.then(blockchains => {
  // 		const current_chain_length = Securum.chain.length;
  // 		let max_chain_length = current_chain_length;
  // 		let new_longest_chain = null;
  // 		let new_pending_transactions = null;

  // 		// console.log(blockchains);

  // 		blockchains.forEach(blockchain => {
  // 			console.log(blockchain);
  // 			if (blockchain.chain.length > max_chain_length) {
  // 				max_chain_length = blockchain.chain.length;
  // 				new_longest_chain = blockchain.chain;
  // 				new_pending_transactions = blockchain.pending_transactions;
  // 			};
  // 		});

  // 		if (!new_longest_chain || (new_longest_chain && !Securum.chainIsValid(new_longest_chain))) {
  // 			res.json({
  // 				note: 'Current chain has not been replaced.',
  // 				chain: Securum.chain
  // 			});
  // 		}
  // 		else {
  // 			Securum.chain = new_longest_chain;
  // 			Securum.pending_transactions = new_pending_transactions;
  // 			res.json({
  // 				note: 'This chain has been replaced.',
  // 				chain: Securum.chain
  // 			});
  // 		}
  // 	});
  // });

  // consensus
  app.get("/consensus", function (req, res) {
    const requestPromises = [];
    Securum.network_nodes.forEach(networkNodeUrl => {
      let i = 0;
      console.log(i++);
      const requestOptions = {
        uri: networkNodeUrl + "/blockchain",
        method: "GET",
        json: true
      };

      requestPromises.push(rp(requestOptions));
    });

    Promise.all(requestPromises).then(blockchains => {
      const currentChainLength = Securum.chain.length;
      let maxChainLength = currentChainLength;
      let newLongestChain = null;
      let newPendingTransactions = null;

      console.log(blockchains);

      blockchains.forEach(blockchain => {
        // console.log(blockchain);
        if (blockchain.chain.length > maxChainLength) {
          maxChainLength = blockchain.chain.length;
          newLongestChain = blockchain.chain;
          newPendingTransactions = blockchain.pendingTransactions;
        }
      });

      if (
        !newLongestChain ||
        (newLongestChain && !Securum.chainIsValid(newLongestChain))
      ) {
        res.json({
          note: "Current chain has not been replaced.",
          chain: Securum.chain
        });
      } else {
        Securum.chain = newLongestChain;
        Securum.pendingTransactions = newPendingTransactions;
        res.json({
          note: "This chain has been replaced.",
          chain: Securum.chain
        });
      }
    });
  });

  app.get("/block/:block_hash", function (req, res) {
    const block_hash = req.params.block_hash;
    const correct_block = Securum.getBlock(block_hash);
    res.json({
      block: correct_block
    });
  });

  app.get("/transaction/:transaction_id", function (req, res) {
    const transaction_id = req.params.transaction_id;
    const transaction_data = Securum.getTransaction(transaction_id);
    res.json({
      transaction: transaction_data.transaction,
      block: transaction_data.block
    });
  });

  // get address by address
  app.get("/address/:address", function (req, res) {
    const address = req.params.address;
    const addressData = Securum.getAddressData(address);
    res.json({
      addressData: addressData
    });
  });

  // app.get('/address/:address', function(req, res) {
  // 	const address = req.params.address;
  // 	const address_data = Securum.getAddressData(address);

  // 	res.json({
  // 		address_data: address_data
  // 	});
  // });
};

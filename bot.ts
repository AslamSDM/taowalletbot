import { Bot, Context, InlineKeyboard, session, SessionFlavor } from 'grammy';
import { ethers } from 'ethers';

import { decryptPrivateKey, encryptPrivateKey } from './utils/encryption';
import { db } from "./utils/db"
import { mnemonicGenerate } from '@polkadot/util-crypto';

import keyring from '@polkadot/ui-keyring';
import { getBalance, isValidAddress, transfer } from './utils/transfer';
require('dotenv').config();

keyring.loadAll({
    isDevelopment: true, // or false if you're in production
    ss58Format: 42, // this is the prefix for the address, 42 for Kusama, 0 for Polkadot
    // you can also provide `genesisHash` and `store` options if needed
});

interface SessionData {
    amount: string;
    wallet: string;
    address: string;
    transfer_wallet: string;
    mnemonic: string;
    sessionset: boolean;
}
type MyContext = Context & SessionFlavor<SessionData>;
let reply = false;
let input_tag: any = ""
const bot = new Bot<MyContext>(process.env.BOT_KEY as string);
function initial(): SessionData {
    return {
        amount: "0",
        wallet: "",
        address: "",
        transfer_wallet: "",
        mnemonic: "",
        sessionset: false,
    };
}

bot.use(session({ initial }));

async function createWallet(mnemonic: string) {
    const pair= keyring.createFromUri(mnemonic);
    console.log(pair);
    return pair;
}



async function storeChatAndUserId(ctx: Context) {
    const { message } = ctx;
    const chatId = message?.chat?.id;
    const userId = message?.chat?.id;
    if (chatId && userId) {
        const user_exists = await db.collection('linktaowallet_users').doc((chatId).toString()).get();
        if (user_exists.exists) {
            console.log('User already exists');
        } else {
            console.log('User does not exist');
        }
        await db.collection('users').doc(chatId.toString()).set({
            chatId,
            userId,
        }, { merge: true });
    }
}

bot.command('start', async (ctx) => {
    console.log(ctx.message?.chat);
    if(!ctx.session.sessionset){
        const userId = ctx.message?.chat?.id;
        const wallet = await db.collection('linktaowallet_wallets').doc(String(userId)).get();
        const wallet_data = wallet.data()
        if (wallet_data) {
            ctx.session.address = wallet_data.address;
            ctx.session.mnemonic = decryptPrivateKey(wallet_data.encrypted_mnem)
            ctx.session.sessionset = true;
        }
    }
    await storeChatAndUserId(ctx);
    const userId = ctx.message?.chat?.id;
    const wallet = await db.collection('linktaowallet_wallets').doc(String(userId)).get();
    const wallet_data = wallet.data()
    console.log(wallet_data);
    if (wallet_data) {
        const address = wallet_data.address;
        const mnemonic = wallet_data.mnemonic;
        const existing_board = new InlineKeyboard()
        existing_board.text("Transfer", "transfer").row()
        existing_board.text("Wallet", "wallet")
        await ctx.reply(`Your wallet is already set to <code>${address} </code>`, {
            parse_mode: 'HTML',
            reply_markup: existing_board
        });
    } else {
        const new_board = new InlineKeyboard()
        new_board.text('Wallets', 'filler').row()
        new_board.text('Link Wallet', 'link_wallet')
        new_board.text('Generate Wallet', 'gen_wallet')
        await ctx.reply('Welcome to the linktaowallet bot\nTo link your wallet, please send your private key', {
            reply_markup: new_board
        });
    }
})
bot.command('wallet', async (ctx) => {
    if(!ctx.session.sessionset){
        const userId = ctx.message?.chat?.id;
        const wallet = await db.collection('linktaowallet_wallets').doc(String(userId)).get();
        const wallet_data = wallet.data()
        if (wallet_data) {
            ctx.session.address = wallet_data.address;
            ctx.session.mnemonic = decryptPrivateKey(wallet_data.encrypted_mnem)
            ctx.session.sessionset = true;
        }
    }
    if(ctx.session.address === ""){
        const new_board = new InlineKeyboard()
        new_board.text('Wallets', 'filler').row()
        new_board.text('Link Wallet', 'link_wallet')
        new_board.text('Generate Wallet', 'gen_wallet')
        await ctx.reply('Wallet not set\n please set or generate a wallet',{
            reply_markup: new_board
        });
        return;
    }
    const balance = await getBalance(ctx.session.address);
    await ctx.reply(`Your wallet is set to <code>${ctx.session.address} </code>\nBalance: <code>${balance} </code>`, {
        parse_mode: 'HTML'
    });
})
bot.command('transfer', async (ctx) => {
    if(!ctx.session.sessionset){
        const userId = ctx.message?.chat?.id;
        const wallet = await db.collection('linktaowallet_wallets').doc(String(userId)).get();
        const wallet_data = wallet.data()
        if (wallet_data) {
            ctx.session.address = wallet_data.address;
            ctx.session.mnemonic = decryptPrivateKey(wallet_data.encrypted_mnem)
            ctx.session.sessionset = true;
        }
    }
    if(ctx.session.address === ""){
        const new_board = new InlineKeyboard()
        new_board.text('Wallets', 'filler').row()
        new_board.text('Link Wallet', 'link_wallet')
        new_board.text('Generate Wallet', 'gen_wallet')
        await ctx.reply('Wallet not set\n please set or generate a wallet',{
            reply_markup: new_board
        });
        return;
    }
 
    const balance = await getBalance(ctx.session.address);
    const new_board = new InlineKeyboard()
    new_board.text('Transfer to', 'transfer_wallet').row()
    new_board.text('Amount', 'amount').row()
    new_board.text('Transfer', 'transfer_place').row()
    ctx.reply(`Transfer menu\n<b>$TAO</b> balance: ${balance} `, {
        reply_markup: new_board,
        parse_mode: 'HTML'
    });
})
    
bot.on('message', async (ctx) => {
    const message = ctx.message?.text;
    if(!ctx.session.sessionset){
        const userId = ctx.message?.chat?.id;
        const wallet = await db.collection('linktaowallet_wallets').doc(String(userId)).get();
        const wallet_data = wallet.data()
        if (wallet_data) {
            ctx.session.address = wallet_data.address;
            ctx.session.mnemonic = decryptPrivateKey(wallet_data.encrypted_mnem)
            ctx.session.sessionset = true;
        }
    }
    console.log(ctx.session);
    if(!reply) return;
    switch (input_tag) {
        case "mnemonic":
            const mnemonic = ctx.message?.text;
            ctx.session.mnemonic = mnemonic as string;
            try {
                const { pair, json } = keyring.addUri(mnemonic as string, "password");
                const address = pair.address;
                ctx.session.address = address;
                const encrypted_mnem = encryptPrivateKey(mnemonic as string);
                await db.collection('linktaowallet_wallets').doc(String(ctx.chat?.id)).set({
                    address,
                    encrypted_mnem
                }, { merge: true });
                await ctx.reply(`Your wallet has been set to <code>${address} </code>`, {
                    parse_mode: 'HTML'
                });
                input_tag = "";
                reply = false;
            }
            catch (e) {
                console.log(e);
                await ctx.reply('Invalid mnemonic.Try again');
            }
            break;
        case "transfer_wallet":
            const address = ctx.message?.text;
            ctx.session.transfer_wallet = address as string;
            if(!isValidAddress(address as string)){
                await ctx.reply('Invalid address. Please try again');
                return;
            }
            await ctx.reply(`Transfer wallet set to <code>${address} </code>`, {
                parse_mode: 'HTML'
            });
            input_tag = "";
            reply = false;
            break;
        case "amount":
            const amount = ctx.message?.text;
            ctx.session.amount = amount as string;
            if(isNaN(Number(amount))){
                await ctx.reply('Invalid amount. Please try again');
                return;
            }
            await ctx.reply(`Amount set to <code>${amount} </code>`, {
                parse_mode: 'HTML'
            });
            input_tag = "";
            reply = false;
            break;
        default:
            break;

    }
})



bot.callbackQuery('link_wallet', async (ctx) => {
    reply = true;
    input_tag = "mnemonic";
    await ctx.reply('Your Previos wallet will be overwritten. If you dont want to overwrite, press /start to start over.');
    await ctx.reply('Please send your mnemonic phrase');
})
bot.callbackQuery('gen_wallet', async (ctx) => {
    if(ctx.session.address !== ""){
        await ctx.reply('Wallet already set');
        return;
    }
    const mnemonic = mnemonicGenerate();
    const wallet = await createWallet(mnemonic);
    const address = wallet.address;
    const encrypted_mnem = encryptPrivateKey(mnemonic);
    await db.collection('linktaowallet_wallets').doc(String(ctx.chat?.id)).set({
        address,
        encrypted_mnem
    }, { merge: true });
    await ctx.reply(`Your wallet has been set to \n<code>${address} </code>\n Mnemonic phase:\n <code>${mnemonic} </code>`, {
        parse_mode: 'HTML'
    });
})
bot.callbackQuery('wallet', async (ctx) => {
    const new_board = new InlineKeyboard()
    new_board.text('Wallets', 'filler').row()
    new_board.text('Link Wallet', 'link_wallet')
    new_board.text('Generate Wallet', 'gen_wallet')
    ctx.reply('Wallet menu', {
        reply_markup: new_board
    });
})
bot.callbackQuery('transfer', async (ctx) => {
    if(ctx.session.address === ""){
        const new_board = new InlineKeyboard()
        new_board.text('Wallets', 'filler').row()
        new_board.text('Link Wallet', 'link_wallet')
        new_board.text('Generate Wallet', 'gen_wallet')
        await ctx.reply('Wallet not set\n please set or generate a wallet',{
            reply_markup: new_board
        });
        return;
    }
    const balance = await getBalance(ctx.session.address);
    const new_board = new InlineKeyboard()
    new_board.text('Transfer to', 'transfer_wallet').row()
    new_board.text('Amount', 'amount').row()
    new_board.text('Transfer', 'transfer_place').row()
    ctx.reply(`Transfer menu\n<b>$TAO</b> balance: ${balance} `, {
        reply_markup: new_board,
        parse_mode: 'HTML'
    });
})
bot.callbackQuery('transfer_wallet', async (ctx) => {
    reply = true;
    input_tag = "transfer_wallet";
    await ctx.reply('Please send the address of the recipient');
})
bot.callbackQuery('amount', async (ctx) => {
    reply = true;
    input_tag = "amount";
    await ctx.reply('Please send the amount to transfer');
})
bot.callbackQuery('transfer_place', async (ctx) => {
    const { amount, transfer_wallet } = ctx.session;
    if (amount === "0" || transfer_wallet === "") {
        await ctx.reply('Please set all the fields');
        return;
    } 
    const wallet = await db.collection('linktaowallet_wallets').doc(String(ctx.chat?.id)).get();
    const wallet_data = wallet.data()
    if(!wallet_data){
        const new_board = new InlineKeyboard()
        new_board.text('Wallets', 'filler').row()
        new_board.text('Link Wallet', 'link_wallet')
        new_board.text('Generate Wallet', 'gen_wallet')
        await ctx.reply('Wallet not set\n please set or generate a wallet',{
            reply_markup: new_board
        });
        return;
    }
    const encrypted_mnem = wallet_data?.encrypted_mnem;
    const mnemonic = decryptPrivateKey(encrypted_mnem as string);
    const pair = keyring.createFromUri(mnemonic);
    try{
        await ctx.reply('Transfer in progress');
        const r = await transfer(mnemonic, transfer_wallet, amount,keyring);
        console.log(r);
        await ctx.reply(`Transfer successful with hash \n<code>${r}</code>\n<a href="https://x.taostats.io/search?query=${r}">View txn</a>`, {
            parse_mode: 'HTML'
            });
    }catch(e:any){
        console.log(e);
        await ctx.reply(`Transfer failed\n${e.message}`);
    }


})

bot.api.setMyCommands([
    { command: 'start', description: 'Start the bot' },
    { command: 'wallet', description: 'Wallet menu' },
    { command: 'transfer', description: 'Transfer menu' },
]);

bot.start();
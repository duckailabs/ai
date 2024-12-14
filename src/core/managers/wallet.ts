import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  Transaction,
  type TransactionConfirmationStrategy,
} from "@solana/web3.js";
import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";

export class DuckAiTokenAirdrop {
  private connection: Connection;
  private turnkeySigner: TurnkeySigner;
  private fromAddress: string;
  private mintAddress: string;
  private AIRDROP_AMOUNT = 6900; // Amount from your requirements

  constructor(
    turnkeyClient: Turnkey,
    fromAddress: string,
    mintAddress: string,
    rpcUrl: string = "https://api.devnet.solana.com"
  ) {
    this.connection = new Connection(rpcUrl, "confirmed");
    this.turnkeySigner = new TurnkeySigner({
      organizationId: turnkeyClient.config.defaultOrganizationId,
      client: turnkeyClient.apiClient(),
    });
    this.fromAddress = fromAddress;
    this.mintAddress = mintAddress;
  }

  async airdropTokens(recipientAddress: string): Promise<string> {
    try {
      if (!recipientAddress) {
        throw new Error("Recipient address is required");
      }

      const fromPubkey = new PublicKey(this.fromAddress);
      const mintPubkey = new PublicKey(this.mintAddress);
      const recipientPubkey = new PublicKey(recipientAddress);

      // Get the ATA for the sender
      const fromAta = await getAssociatedTokenAddress(
        mintPubkey,
        fromPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Get or create the ATA for the recipient
      const toAta = await getAssociatedTokenAddress(
        mintPubkey,
        recipientPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Check if recipient's ATA exists
      const recipientAtaInfo = await this.connection.getAccountInfo(toAta);

      const transaction = new Transaction();

      // If recipient's ATA doesn't exist, create it
      if (!recipientAtaInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            fromPubkey,
            toAta,
            recipientPubkey,
            mintPubkey,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      // Add transfer instruction
      transaction.add(
        createTransferInstruction(
          fromAta,
          toAta,
          fromPubkey,
          this.AIRDROP_AMOUNT * Math.pow(10, 6) // Assuming 6 decimals
        )
      );

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } =
        await this.connection.getLatestBlockhash("confirmed");

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      // Sign transaction
      await this.turnkeySigner.addSignature(transaction, this.fromAddress);

      // Send transaction
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        { skipPreflight: false }
      );

      // Confirm transaction
      const confirmationStrategy: TransactionConfirmationStrategy = {
        signature,
        blockhash,
        lastValidBlockHeight,
      };

      await this.connection.confirmTransaction(confirmationStrategy);

      return signature;
    } catch (error) {
      console.error("Error in airdropTokens:", error);
      throw error;
    }
  }

  async airdropToMultipleRecipients(
    addresses: (string | undefined)[]
  ): Promise<string[]> {
    const signatures: string[] = [];
    const validAddresses = addresses.filter((addr): addr is string => !!addr);

    for (const address of validAddresses) {
      try {
        const signature = await this.airdropTokens(address);
        signatures.push(signature);
        // Add a small delay between transactions to prevent rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to airdrop to ${address}:`, error);
      }
    }

    return signatures;
  }
}

import AcpClient, { AcpContractClient, AcpJob, AcpJobPhases } from "@virtuals-protocol/acp-node";
import * as dotenv from 'dotenv';
import { logAction } from './lib/utils';

dotenv.config();

async function main() {
  logAction("BUYER_START", "SYSTEM", `Starting ACP Buyer Integration - Entity: ${process.env.BUYER_ENTITY_ID}, Wallet: ${process.env.BUYER_AGENT_WALLET_ADDRESS}`, 'INFO');

  const WHITELISTED_WALLET_PRIVATE_KEY = process.env.WHITELISTED_WALLET_PRIVATE_KEY as `0x${string}`;
  const BUYER_ENTITY_ID = Number(process.env.BUYER_ENTITY_ID);
  const BUYER_AGENT_WALLET_ADDRESS = process.env.BUYER_AGENT_WALLET_ADDRESS as `0x${string}`;
  
  if (!WHITELISTED_WALLET_PRIVATE_KEY.startsWith('0x')) {
    throw new Error('Private key must start with 0x');
  }
  
  const acpClient = new AcpClient({
    acpContractClient: await AcpContractClient.build(
        WHITELISTED_WALLET_PRIVATE_KEY,
        BUYER_ENTITY_ID,
        BUYER_AGENT_WALLET_ADDRESS,
    ),
    onNewTask: async (job: AcpJob) => {
        logAction("NEW_TASK_RECEIVED", job.id.toString(), `Phase: ${job.phase}, Price: ${job.price}, Memos: ${job.memos?.length || 0}`, 'INFO');

        if (
            job.phase === AcpJobPhases.NEGOTIATION &&
            job.memos.find((m) => m.nextPhase === AcpJobPhases.TRANSACTION)
        ) {
            logAction("PAYMENT_PROCESSING", job.id.toString(), `Processing payment of ${job.price}`, 'INFO');
            try {
                await job.pay(job.price);
                logAction("PAYMENT_COMPLETED", job.id.toString(), `Payment of ${job.price} completed successfully`, 'SUCCESS');
            } catch (error) {
                logAction("PAYMENT_FAILED", job.id.toString(), `Payment of ${job.price} failed: ${error instanceof Error ? error.message : String(error)}`, 'ERROR');
                console.log("Continuing execution...");
            }
        } else if (job.phase === AcpJobPhases.COMPLETED) {
            logAction("JOB_COMPLETED", job.id.toString(), "Job completed successfully", 'SUCCESS');
        } else if (job.phase === AcpJobPhases.REJECTED) {
            logAction("JOB_REJECTED", job.id.toString(), "Job was rejected", 'INFO');
        }
    },
    onEvaluate: async (job: AcpJob) => {
        logAction("JOB_EVALUATION_STARTED", job.id.toString(), "Starting job evaluation", 'INFO');
        try {
            await job.evaluate(true, "Self-evaluated and approved");
            logAction("JOB_EVALUATION_COMPLETED", job.id.toString(), "Job evaluation completed - approved", 'SUCCESS');
        } catch (error) {
            logAction("JOB_EVALUATION_FAILED", job.id.toString(), `Job evaluation failed: ${error instanceof Error ? error.message : String(error)}`, 'ERROR');
            console.log("Continuing execution...");
        }
    },
});


logAction("ACP_CLIENT_READY", "SYSTEM", "ACP Client initialized and listening for tasks", 'SUCCESS');
}

main().catch(error => {
  logAction("CRITICAL_ERROR", "SYSTEM", `Critical error in main process: ${error instanceof Error ? error.message : String(error)}. Stack: ${error instanceof Error ? error.stack : 'N/A'}`, 'ERROR');
  console.log("Program finished with error but didn't crash");
});

import AcpClient, { AcpAgentSort, AcpContractClient, AcpGraduationStatus, AcpJob, AcpJobPhases } from "@virtuals-protocol/acp-node";
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { logAction } from './lib/utils';

dotenv.config();

interface CleanAgentData {
  id: number;
  name: string;
  description: string;
  twitterHandle?: string;
  walletAddress: string;
  metrics: {
    successfulJobCount: number;
    successRate: number;
    uniqueBuyerCount: number;
    isOnline: boolean;
    minsFromLastOnlineTime: number;
    lastActiveAt: string;
  };
  offerings: CleanOfferingData[];
}

interface CleanOfferingData {
  id: number;
  name: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  estimatedDuration?: string;
  tags?: string[];
  requirements?: string[];
  deliverables?: string[];
  requirementSchema?: any;
}

function cleanAgentData(agent: any): CleanAgentData {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    twitterHandle: agent.twitterHandle,
    walletAddress: agent.walletAddress,
    metrics: {
      successfulJobCount: agent.metrics.successfulJobCount,
      successRate: agent.metrics.successRate,
      uniqueBuyerCount: agent.metrics.uniqueBuyerCount,
      isOnline: agent.metrics.isOnline,
      minsFromLastOnlineTime: agent.metrics.minsFromLastOnlineTime,
      lastActiveAt: agent.metrics.lastActiveAt
    },
    offerings: agent.offerings.map((offering: any) => cleanOfferingData(offering))
  };
}

function cleanOfferingData(offering: any): CleanOfferingData {
  // Función para limpiar objetos que pueden tener referencias circulares
  const cleanObject = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') return obj;
    if (Array.isArray(obj)) return obj.map(cleanObject);
    if (typeof obj === 'object') {
      try {
        JSON.stringify(obj);
        return obj;
      } catch (e) {
        return { circularReference: true, type: obj.constructor?.name || 'Object' };
      }
    }
    return obj;
  };

  return {
    id: offering.id,
    name: offering.name,
    title: offering.title,
    description: offering.description,
    price: offering.price,
    currency: offering.currency,
    estimatedDuration: offering.estimatedDuration,
    tags: offering.tags,
    requirements: offering.requirements,
    deliverables: offering.deliverables,
    requirementSchema: cleanObject(offering.requirementSchema)
  };
}


async function searchAgentsByAlphabet(acpClient: AcpClient, letters: string[]): Promise<CleanAgentData[]> {
  const allAgents = new Map<number, CleanAgentData>();

  logAction("ALPHABET_SEARCH_START", "SYSTEM", `Starting alphabet search with letters: ${letters.join(', ')}`, 'INFO');

  for (const letter of letters) {
    try {
      logAction("SEARCH_LETTER", "SYSTEM", `Searching for agents starting with letter: "${letter}"`, 'INFO');
      
      const agents = await acpClient.browseAgents(letter, {
        cluster: "",
        sort_by: [AcpAgentSort.SUCCESSFUL_JOB_COUNT],
        top_k: 30,
        graduationStatus: AcpGraduationStatus.GRADUATED
      });


      if (agents && agents.length > 0) {
        logAction("SEARCH_RESULTS", "SYSTEM", `Found ${agents.length} agents for letter "${letter}"`, 'SUCCESS');
        
        if (agents[0] && agents[0].offerings && agents[0].offerings.length > 0) {
          const offering = agents[0].offerings[0] as any;
          console.log(`ID:`, offering.id);
          console.log(`Name:`, offering.name);
          console.log(`Title:`, offering.title);
          console.log(`Price:`, offering.price);
          console.log(`Currency:`, offering.currency);
        }
        
        agents.forEach(agent => {
          const cleanAgent = cleanAgentData(agent);
          allAgents.set(agent.id, cleanAgent);
        });
      } else {
        logAction("SEARCH_NO_RESULTS", "SYSTEM", `No agents found for letter "${letter}"`, 'INFO');
      }

      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      logAction("SEARCH_ERROR", "SYSTEM", `Error searching for letter "${letter}": ${error instanceof Error ? error.message : String(error)}`, 'ERROR');
    }
  }

  const uniqueAgents = Array.from(allAgents.values());
  logAction("ALPHABET_SEARCH_COMPLETE", "SYSTEM", `Alphabet search completed. Found ${uniqueAgents.length} unique agents`, 'SUCCESS');
  
  return uniqueAgents;
}


function saveAgentResults(agents: CleanAgentData[], filename: string = 'agent_search_results.json'): void {
  const filePath = path.join(process.cwd(), filename);
  
  const results = {
    timestamp: new Date().toISOString(),
    totalAgents: agents.length,
    agents: agents
  };
  
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
  logAction("RESULTS_SAVED", "SYSTEM", `Agent search results saved to ${filename}`, 'SUCCESS');
}


function generateAgentSummary(agents: CleanAgentData[]): void {
  console.log(`\n📈 Resumen de búsqueda de agentes:`);
  console.log(`Total de agentes encontrados: ${agents.length}`);
  
  if (agents.length === 0) {
    console.log('No se encontraron agentes en los resultados de búsqueda.');
    return;
  }
  
  const totalOfferings = agents.reduce((sum, agent) => sum + agent.offerings.length, 0);
  const avgSuccessRate = agents.reduce((sum, agent) => sum + agent.metrics.successRate, 0) / agents.length;
  const onlineAgents = agents.filter(agent => agent.metrics.isOnline).length;
  const topPerformers = agents
    .sort((a, b) => b.metrics.successfulJobCount - a.metrics.successfulJobCount)
    .slice(0, 5);
  
    topPerformers.forEach((agent, index) => {
    console.log(`  ${index + 1}. ${agent.name} - ${agent.metrics.successfulJobCount} trabajos (${agent.metrics.successRate}% éxito)`);
  });
}

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
  });

  const testLetters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));
  logAction("ALPHABET_SEARCH_FULL", "SYSTEM", `Starting full alphabet search (a-z)`, 'INFO');
  
  const foundAgents = await searchAgentsByAlphabet(acpClient, testLetters);
  
  console.log(`\n🔍 Resultados de búsqueda por letras:`);
  console.log(`Encontrados ${foundAgents.length} agentes únicos`);
  
  if (foundAgents.length > 0) {
    console.log(`\n📋 Resumen de agentes encontrados:`);
    foundAgents.forEach((agent, index) => {
      console.log(`\n${index + 1}. ${agent.name} (ID: ${agent.id})`);
    });
  } else {
    console.log('No se encontraron agentes con las letras a, b, c');
  }

  if (foundAgents.length > 0) {
    saveAgentResults(foundAgents);
    generateAgentSummary(foundAgents);
  }

logAction("ACP_CLIENT_READY", "SYSTEM", "ACP Client initialized and listening for tasks", 'SUCCESS');
}

main().catch(error => {
  logAction("CRITICAL_ERROR", "SYSTEM", `Critical error in main process: ${error instanceof Error ? error.message : String(error)}. Stack: ${error instanceof Error ? error.stack : 'N/A'}`, 'ERROR');
  console.log("Program finished with error but didn't crash");
});

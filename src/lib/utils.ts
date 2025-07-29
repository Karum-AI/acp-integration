import * as fs from 'fs';
import * as path from 'path';

/**
 * Logs actions to both console and CSV file for audit purposes
 * @param action - The action being performed
 * @param jobId - The job ID or system identifier
 * @param details - Additional details about the action
 * @param status - The status of the action
 */
export function logAction(action: string, jobId: string, details: string = '', status: 'SUCCESS' | 'ERROR' | 'INFO' = 'INFO') {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp},${action},${jobId},${status},"${details.replace(/"/g, '""')}"\n`;
  
  const logFile = path.join(process.cwd(), 'acp_actions.csv');
  
  if (!fs.existsSync(logFile)) {
    const header = 'timestamp,action,job_id,status,details\n';
    fs.writeFileSync(logFile, header);
  }
  
  fs.appendFileSync(logFile, logEntry);
  
  console.log(`[${timestamp}] ${action} - Job: ${jobId} - Status: ${status} - ${details}`);
}

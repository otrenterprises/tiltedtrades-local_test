import boto3
import logging
import traceback
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from utils.config import Config

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize SES client
ses_client = boto3.client('ses', region_name=Config.REGION)

def send_error_notification(error_type: str, error_message: str, event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sends error notification emails via AWS SES.
    
    This handler:
    1. Formats detailed error messages
    2. Sends emails to configured notification recipients
    3. Logs the notification attempt
    
    Args:
        error_type (str): Type of error (e.g., "Validation Error", "DynamoDB Error")
        error_message (str): Detailed error message
        event (dict): The original event that triggered the Lambda
        
    Returns:
        dict: Result with success/failure status
    """
    try:
        # Log the notification attempt
        logger.info(f"Sending error notification for: {error_type}")
        
        # Get the file information from the event if available
        file_info = "Unknown file"
        try:
            if 'Records' in event and len(event['Records']) > 0:
                if 's3' in event['Records'][0]:
                    bucket = event['Records'][0]['s3']['bucket']['name']
                    key = event['Records'][0]['s3']['object']['key']
                    file_info = f"s3://{bucket}/{key}"
        except Exception as e:
            logger.error(f"Error extracting file info from event: {str(e)}")
        
        # Format the timestamp
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')
        
        # Create a unique error reference ID
        error_ref = datetime.now().strftime('%Y%m%d%H%M%S')
        
        # Format the email subject
        subject = f"[ERROR] Trading Data Processing - {error_type}"
        
        # Format the email body
        body_html = f"""
        <html>
        <head></head>
        <body>
            <h2>Error in Trading Data Processing</h2>
            <p><strong>Time:</strong> {timestamp}</p>
            <p><strong>File:</strong> {file_info}</p>
            <p><strong>Error Type:</strong> {error_type}</p>
            <p><strong>Error Message:</strong></p>
            <pre>{error_message}</pre>
            <p><strong>Error Reference:</strong> {error_ref}</p>
            <h3>Troubleshooting Steps:</h3>
            <ol>
                <li>Check the file in S3 bucket for any issues</li>
                <li>Verify the data in OriginalOrders DynamoDB table</li>
                <li>Review the logs in CloudWatch (Log Group: /aws/lambda/ConsolidatedTraderLambda)</li>
            </ol>
        </body>
        </html>
        """
        
        body_text = f"""
        Error in Trading Data Processing
        
        Time: {timestamp}
        File: {file_info}
        Error Type: {error_type}
        Error Message: {error_message}
        
        Error Reference: {error_ref}
        
        Troubleshooting Steps:
        1. Check the file in S3 bucket for any issues
        2. Verify the data in OriginalOrders DynamoDB table
        3. Review the logs in CloudWatch (Log Group: /aws/lambda/ConsolidatedTraderLambda)
        """
        
        # Send the email via SES
        response = ses_client.send_email(
            Source=Config.FROM_EMAIL,
            Destination={
                'ToAddresses': [Config.NOTIFICATION_EMAIL]
            },
            Message={
                'Subject': {
                    'Data': subject
                },
                'Body': {
                    'Text': {
                        'Data': body_text
                    },
                    'Html': {
                        'Data': body_html
                    }
                }
            }
        )
        
        logger.info(f"Error notification sent successfully: {response['MessageId']}")
        
        return {
            'success': True,
            'message': f"Error notification sent successfully",
            'message_id': response['MessageId']
        }
        
    except Exception as e:
        error_msg = f"Error sending notification: {str(e)}"
        logger.error(error_msg)
        logger.error(traceback.format_exc())
        return {
            'success': False,
            'message': error_msg
        }

def send_success_notification(success_type: str, success_message: str, 
                             file_info: str = "Unknown file",
                             statistics: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Sends success notification emails via AWS SES.
    
    This handler:
    1. Formats detailed success messages
    2. Sends emails to configured notification recipients
    3. Logs the notification attempt
    
    Args:
        success_type (str): Type of success (e.g., "Processing Complete", "Data Loaded")
        success_message (str): Detailed success message
        file_info (str): Information about the file being processed
        statistics (dict): Optional statistics about the process
        
    Returns:
        dict: Result with success/failure status
    """
    try:
        # Log the notification attempt
        logger.info(f"Sending success notification for: {success_type}")
        
        # Format the timestamp
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')
        
        # Create a unique reference ID
        ref_id = datetime.now().strftime('%Y%m%d%H%M%S')
        
        # Format the email subject
        subject = f"[SUCCESS] Trading Data Processing - {success_type}"
        
        # Process statistics if provided
        stats_html = ""
        stats_text = ""
        
        if statistics:
            stats_html = "<h3>Processing Statistics:</h3><table border='1' cellpadding='5'>"
            stats_text = "Processing Statistics:\n"
            
            for key, value in statistics.items():
                # Format for HTML table
                stats_html += f"<tr><td><strong>{key}</strong></td><td>{value}</td></tr>"
                
                # Format for plain text
                stats_text += f"- {key}: {value}\n"
            
            stats_html += "</table>"
        
        # Format the email body
        body_html = f"""
        <html>
        <head></head>
        <body>
            <h2>Success in Trading Data Processing</h2>
            <p><strong>Time:</strong> {timestamp}</p>
            <p><strong>File:</strong> {file_info}</p>
            <p><strong>Process:</strong> {success_type}</p>
            <p><strong>Details:</strong> {success_message}</p>
            <p><strong>Reference ID:</strong> {ref_id}</p>
            {stats_html}
        </body>
        </html>
        """
        
        body_text = f"""
        Success in Trading Data Processing
        
        Time: {timestamp}
        File: {file_info}
        Process: {success_type}
        Details: {success_message}
        
        Reference ID: {ref_id}
        
        {stats_text}
        """
        
        # Send the email via SES
        response = ses_client.send_email(
            Source=Config.FROM_EMAIL,
            Destination={
                'ToAddresses': [Config.NOTIFICATION_EMAIL]
            },
            Message={
                'Subject': {
                    'Data': subject
                },
                'Body': {
                    'Text': {
                        'Data': body_text
                    },
                    'Html': {
                        'Data': body_html
                    }
                }
            }
        )
        
        logger.info(f"Success notification sent successfully: {response['MessageId']}")
        
        return {
            'success': True,
            'message': f"Success notification sent successfully",
            'message_id': response['MessageId']
        }
        
    except Exception as e:
        error_msg = f"Error sending success notification: {str(e)}"
        logger.error(error_msg)
        logger.error(traceback.format_exc())
        return {
            'success': False,
            'message': error_msg
        }

def log_success(result_data: Dict[str, Any]) -> None:
    """
    Logs successful processing results for monitoring purposes.
    
    Args:
        result_data (dict): Data about the successful operation
    """
    try:
        # Format as JSON for easier parsing in CloudWatch
        formatted_data = json.dumps(result_data, default=str)
        logger.info(f"SUCCESS_METRICS: {formatted_data}")
    except Exception as e:
        logger.error(f"Error logging success metrics: {str(e)}")

def log_metrics(execution_time: float, steps: List[Dict[str, Any]]) -> None:
    """
    Logs performance metrics for monitoring and optimization.
    
    Args:
        execution_time (float): Total execution time in seconds
        steps (list): List of processing steps with timing data
    """
    try:
        # Extract metrics from steps
        metrics = {
            'execution_time_seconds': execution_time,
            'step_count': len(steps),
            'steps': {step['name']: {'status': step['status']} for step in steps}
        }
        
        # Format as JSON for easier parsing in CloudWatch
        formatted_metrics = json.dumps(metrics, default=str)
        logger.info(f"PERFORMANCE_METRICS: {formatted_metrics}")
    except Exception as e:
        logger.error(f"Error logging performance metrics: {str(e)}")
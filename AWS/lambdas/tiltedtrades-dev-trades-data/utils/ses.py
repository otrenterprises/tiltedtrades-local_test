"""
SES Email Utility Functions

This module provides utility functions for sending emails via AWS SES,
including formatting, templates, and retry logic.
"""

import boto3
import logging
import json
import time
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
from botocore.exceptions import ClientError
from utils.config import Config

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Initialize SES client with region
ses_client = boto3.client('ses', region_name=Config.REGION)

def send_email(subject: str, body_html: str, body_text: str, 
               recipients: List[str] = None, sender: str = None, 
               max_retries: int = 3) -> Dict[str, Any]:
    """
    Sends an email via AWS SES with retry logic.
    
    Args:
        subject: Email subject
        body_html: HTML body content
        body_text: Plain text body content
        recipients: List of recipient email addresses (default: Config.NOTIFICATION_EMAIL)
        sender: Sender email address (default: Config.FROM_EMAIL)
        max_retries: Maximum number of retry attempts (default: 3)
        
    Returns:
        Dict[str, Any]: Result with success/failure status and details
    """
    # Use default values if not provided
    if recipients is None:
        recipients = [Config.NOTIFICATION_EMAIL]
    
    if sender is None:
        sender = Config.FROM_EMAIL
    
    # Ensure recipients is a list
    if isinstance(recipients, str):
        recipients = [recipients]
    
    # Validate input
    if not subject or not body_html or not body_text:
        error_msg = "Email subject, HTML body, and text body are required"
        logger.error(error_msg)
        return {
            'success': False,
            'message': error_msg
        }
    
    # Create email message
    message = {
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
    
    # Set up retry with exponential backoff
    retry_count = 0
    while retry_count < max_retries:
        try:
            # Send email via SES
            response = ses_client.send_email(
                Source=sender,
                Destination={
                    'ToAddresses': recipients
                },
                Message=message
            )
            
            logger.info(f"Email sent successfully to {', '.join(recipients)}")
            logger.info(f"SES Message ID: {response['MessageId']}")
            
            return {
                'success': True,
                'message': 'Email sent successfully',
                'message_id': response['MessageId']
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_msg = e.response['Error']['Message']
            
            # Log error details
            logger.error(f"Error sending email: {error_code} - {error_msg}")
            
            # Determine if we should retry based on error code
            if error_code in ['Throttling', 'ServiceUnavailable', 'LimitExceededException']:
                retry_count += 1
                if retry_count < max_retries:
                    # Calculate backoff time: 2^retry_count seconds (1, 2, 4, etc.)
                    backoff_time = 2 ** retry_count
                    logger.info(f"Retrying in {backoff_time} seconds (attempt {retry_count} of {max_retries})")
                    time.sleep(backoff_time)
                else:
                    # Max retries reached
                    logger.error(f"Max retries ({max_retries}) reached. Email not sent.")
                    return {
                        'success': False,
                        'message': f"Failed to send email after {max_retries} attempts: {error_code} - {error_msg}"
                    }
            else:
                # Non-retryable error
                return {
                    'success': False,
                    'message': f"Error sending email: {error_code} - {error_msg}"
                }
        
        except Exception as e:
            # Handle unexpected errors
            error_msg = f"Unexpected error sending email: {str(e)}"
            logger.error(error_msg)
            return {
                'success': False,
                'message': error_msg
            }
    
    # This should not be reached, but just in case
    return {
        'success': False,
        'message': f"Failed to send email after {max_retries} attempts"
    }

def format_error_email(error_type: str, error_message: str, 
                      file_info: str = "Unknown file",
                      additional_details: Dict[str, Any] = None) -> Dict[str, str]:
    """
    Formats an error notification email with standard template.
    
    Args:
        error_type: Type of error (e.g., "Validation Error", "DynamoDB Error")
        error_message: Detailed error message
        file_info: Information about the file being processed (default: "Unknown file")
        additional_details: Optional additional details to include
        
    Returns:
        Dict[str, str]: Dictionary with subject, body_html, and body_text
    """
    # Format timestamp
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')
    
    # Create error reference ID for tracking
    error_ref = datetime.now().strftime('%Y%m%d%H%M%S')
    
    # Format the email subject
    subject = f"[ERROR] Trading Data Processing - {error_type}"
    
    # Process additional details if provided
    details_html = ""
    details_text = ""
    
    if additional_details:
        details_html = "<h3>Additional Details:</h3><ul>"
        details_text = "Additional Details:\n"
        
        for key, value in additional_details.items():
            # Format value for HTML and plain text
            if isinstance(value, (dict, list)):
                value_str = json.dumps(value, indent=2)
                details_html += f"<li><strong>{key}:</strong> <pre>{value_str}</pre></li>"
            else:
                details_html += f"<li><strong>{key}:</strong> {value}</li>"
            
            details_text += f"- {key}: {value}\n"
        
        details_html += "</ul>"
    
    # Format HTML body
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
        {details_html}
        <h3>Troubleshooting Steps:</h3>
        <ol>
            <li>Check the file in S3 bucket for any issues</li>
            <li>Verify the data in OriginalOrders DynamoDB table</li>
            <li>Review the logs in CloudWatch (Log Group: /aws/lambda/ConsolidatedTraderLambda)</li>
        </ol>
    </body>
    </html>
    """
    
    # Format plain text body
    body_text = f"""
    Error in Trading Data Processing
    
    Time: {timestamp}
    File: {file_info}
    Error Type: {error_type}
    Error Message: {error_message}
    
    Error Reference: {error_ref}
    
    {details_text}
    
    Troubleshooting Steps:
    1. Check the file in S3 bucket for any issues
    2. Verify the data in OriginalOrders DynamoDB table
    3. Review the logs in CloudWatch (Log Group: /aws/lambda/ConsolidatedTraderLambda)
    """
    
    return {
        'subject': subject,
        'body_html': body_html,
        'body_text': body_text
    }

def format_success_email(success_type: str, success_message: str,
                        file_info: str = "Unknown file",
                        statistics: Dict[str, Any] = None) -> Dict[str, str]:
    """
    Formats a success notification email with standard template.
    
    Args:
        success_type: Type of success (e.g., "Processing Complete", "Data Loaded")
        success_message: Detailed success message
        file_info: Information about the file being processed (default: "Unknown file")
        statistics: Optional statistics to include
        
    Returns:
        Dict[str, str]: Dictionary with subject, body_html, and body_text
    """
    # Format timestamp
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')
    
    # Create reference ID for tracking
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
    
    # Format HTML body
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
    
    # Format plain text body
    body_text = f"""
    Success in Trading Data Processing
    
    Time: {timestamp}
    File: {file_info}
    Process: {success_type}
    Details: {success_message}
    
    Reference ID: {ref_id}
    
    {stats_text}
    """
    
    return {
        'subject': subject,
        'body_html': body_html,
        'body_text': body_text
    }

def send_error_notification(error_type: str, error_message: str, 
                          file_info: str = "Unknown file",
                          additional_details: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Formats and sends an error notification email.
    
    Args:
        error_type: Type of error (e.g., "Validation Error", "DynamoDB Error")
        error_message: Detailed error message
        file_info: Information about the file being processed
        additional_details: Optional additional details to include
        
    Returns:
        Dict[str, Any]: Result with success/failure status
    """
    # Format the email
    email = format_error_email(error_type, error_message, file_info, additional_details)
    
    # Send the email
    return send_email(
        subject=email['subject'],
        body_html=email['body_html'],
        body_text=email['body_text']
    )

def send_success_notification(success_type: str, success_message: str,
                            file_info: str = "Unknown file",
                            statistics: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Formats and sends a success notification email.
    
    Args:
        success_type: Type of success (e.g., "Processing Complete", "Data Loaded")
        success_message: Detailed success message
        file_info: Information about the file being processed
        statistics: Optional statistics to include
        
    Returns:
        Dict[str, Any]: Result with success/failure status
    """
    # Format the email
    email = format_success_email(success_type, success_message, file_info, statistics)
    
    # Send the email
    return send_email(
        subject=email['subject'],
        body_html=email['body_html'],
        body_text=email['body_text']
    )
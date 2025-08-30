import asyncio
import logging
import json
import aiohttp
from typing import Dict, List, Optional, Any
import os

logger = logging.getLogger(__name__)

class LLMClient:
    """Client for interacting with Large Language Models (OpenAI, etc.)."""
    
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY", "your-api-key-here")
        self.base_url = "https://api.openai.com/v1"
        self.model = "gpt-4-vision-preview"  # For image analysis
        self.text_model = "gpt-4"  # For text analysis
        self.max_tokens = 500
        self.temperature = 0.7
        
        # Mock mode for development without API key
        self.mock_mode = self.api_key == "your-api-key-here"
        

    
    async def generate_help_suggestions(self, context: Dict, confusion_level: float) -> List[str]:
        """Generate contextual help suggestions."""
        prompt = f"""
        Generate 2-3 helpful learning suggestions for a student experiencing confusion level {confusion_level:.2f}/1.0.
        
        Context: {json.dumps(context)}
        
        Guidelines:
        - Don't give direct answers
        - Encourage learning process
        - Be specific to the context
        - Keep suggestions under 100 characters each
        
        Return as JSON array of strings.
        """
        
        response = await self.analyze_text(prompt)
        
        if isinstance(response, list):
            return response
        elif isinstance(response, dict) and "suggestions" in response:
            return response["suggestions"]
        else:
            # Fallback suggestions
            return [
                "Break the problem into smaller steps.",
                "Review the relevant concepts first.",
                "Try a simpler example to build understanding."
            ]
    
    async def _mock_image_analysis(self, image_base64: str, prompt: str = None) -> Dict:
        """Mock image analysis for development."""
        # Simulate analysis delay
        await asyncio.sleep(0.5)
        
        return {
            "content": """
            This appears to be an educational screen showing a mathematics problem or programming exercise. 
            The interface includes text fields for input, some instructional content, and what looks like 
            a problem-solving environment. The user seems to be working on equations or code that requires 
            step-by-step thinking. Common areas of confusion might include understanding the problem 
            requirements, applying the correct methodology, or making computational errors.
            """,
            "model": "mock-vision-model",
            "timestamp": asyncio.get_event_loop().time()
        }
    
    
    def set_api_key(self, api_key: str):
        """Set the OpenAI API key."""
        self.api_key = api_key
        self.mock_mode = api_key == "your-api-key-here"
        logger.info(f"LLM client configured. Mock mode: {self.mock_mode}")
    
    def get_status(self) -> Dict:
        """Get LLM client status."""
        return {
            "mock_mode": self.mock_mode,
            "model": self.model,
            "text_model": self.text_model,
            "base_url": self.base_url,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature
        }
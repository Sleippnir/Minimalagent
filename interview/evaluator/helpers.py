from .interview import Interview
from ..config import InterviewConfig

# from .infrastructure.persistence.supabase.interview_repository import load_interview_from_supabase  # Not needed for now
import json
import os
from typing import Dict, Any
import openai
from google import genai
import requests
import asyncio
from datetime import datetime

# Initialize settings
settings = InterviewConfig()


class RealLLMEvaluator:
    """Real LLM evaluation using actual APIs"""

    def __init__(self):
        config = InterviewConfig()
        self.openai_key = config.OPENAI_API_KEY
        self.google_key = config.GOOGLE_API_KEY
        self.deepseek_key = config.DEEPSEEK_API_KEY
        self.openrouter_key = config.OPENROUTER_API_KEY
        
        # Model configurations
        self.openai_model = config.OPENAI_MODEL
        self.google_model = config.GEMINI_MODEL
        self.deepseek_model = config.DEEPSEEK_MODEL

        # Initialize clients
        if self.google_key:
            self.google_client = genai.Client(api_key=self.google_key)

    async def evaluate_with_openai(
        self, transcript: str, job_description: str, evaluator_prompt: str = ""
    ) -> Dict[str, Any]:
        """Evaluate interview using OpenAI GPT-4o"""
        if not self.openai_key:
            return {"error": "OpenAI API key not configured"}

        try:
            client = openai.AsyncOpenAI(api_key=self.openai_key)

            # Use provided evaluator prompt or default
            if evaluator_prompt:
                prompt = f"{evaluator_prompt}\n\nJob Description:\n{job_description}\n\nInterview Transcript:\n{transcript}"
            else:
                prompt = f"""
You are an expert technical interviewer evaluating a candidate for a position.

Job Description:
{job_description}

Interview Transcript:
{transcript}

Please evaluate this candidate's interview performance. Provide:
1. Overall score (1-10, where 10 is perfect)
2. Detailed reasoning for your score
3. Key strengths demonstrated
4. Areas for improvement
5. Hire recommendation (Strong Yes/Maybe/No)

Format your response as JSON with these keys: score, reasoning, strengths, improvements, recommendation
"""

            response = await client.chat.completions.create(
                model=self.openai_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_completion_tokens=1000,
            )

            content = response.choices[0].message.content.strip()

            # Clean up markdown code blocks if present
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            # Try to parse as JSON
            try:
                result = json.loads(content)
                return {
                    "provider": "openai",
                    "model": self.openai_model,
                    "raw_response": content,
                    **result,
                }
            except json.JSONDecodeError:
                return {
                    "provider": "openai",
                    "model": self.openai_model,
                    "raw_response": content,
                    "error": "Failed to parse JSON response",
                }

        except Exception as e:
            return {"error": f"OpenAI API error: {str(e)}"}

    async def evaluate_with_openai_structured(
        self, evaluation_input: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Evaluate interview using OpenAI GPT-4o with structured Evaluator LLM v0.2.0 prompt"""
        if not self.openai_key:
            return {"error": "OpenAI API key not configured"}

        try:
            client = openai.AsyncOpenAI(api_key=self.openai_key)

            # Use the new Evaluator LLM v0.2.0 prompt
            prompt = f"""You are Evaluator LLM (v0.2.0). Your sole function is to critically and fairly evaluate an interview transcript based on the provided materials. You must output **exactly one** valid JSON object that complies with the required output schema. Do not output any text, prose, or explanations before or after the JSON object.

### ETHICS & SAFETY DIRECTIVES

- **Evidence-Based Judgement:** Base all judgments strictly on the content of the provided transcript. Do not infer, assume, or consider any protected attributes (e.g., age, gender, ethnicity, location).
- **No Fabrication:** Do not invent evidence. If the transcript is unclear, ambiguous, or missing information needed to evaluate a criterion, you must state this limitation explicitly in the relevant analysis section.
- **Data Sensitivity:** Treat all input as sensitive and private. Include only necessary, anonymized details from the transcript in your reasoning to support your evaluation.
- **Consistent & Conservative Scoring:** Penalize performance only to the extent supported by direct evidence; maintain consistent standards of judgment within each rubric.

### PART 1 — INPUT DATA STRUCTURE (You will receive one JSON object)

{{
  "interview_id": "UUID",
  "candidate": {{ "first_name": "string", "last_name": "string" }},
  "job": {{ "title": "string", "description": "string" }},
  "evaluation_materials": {{
    "rubrics": {{
      "technical_interview_rubric": {{ "..." }},
      "behavioral_interview_rubric": {{ "..." }}
    }}
  }},
  "transcript_data": {{
    "structured_transcript": [
      {{ "speaker": "interviewer", "text": "string" }},
      {{ "speaker": "candidate", "text": "string" }}
    ]
  }},
  "questions_and_answers": [
    {{
      "position": "integer",
      "question_text": "string",
      "ideal_answer": "string",
      "question_type": "technical"
    }},
    {{
      "position": "integer",
      "question_text": "string",
      "ideal_answer": "string",
      "question_type": "behavioral"
    }}
  ]
}}

### PART 2 — REQUIRED OUTPUT FORMAT (Return only this JSON object)

{{
  "$schema": "...",
  "title": "Interview Evaluation",
  "description": "A structured evaluation of the candidate's performance.",
  "type": "object",
  "properties": {{
    "overall_score": {{
      "description": "The final numeric score, from 1.0 to 100.0, calculated as the average of all per-question scores.",
      "type": "number"
    }},
    "confidence_score": {{
      "description": "The evaluator's confidence in this assessment from 0.00 to 1.00, based on the clarity and completeness of the provided evidence.",
      "type": "number"
    }},
    "overall_summary": {{
      "description": "A 2-3 sentence executive summary of the candidate's performance, justifying the overall_score by highlighting the most significant strengths and weaknesses.",
      "type": "string"
    }},
    "strengths": {{
      "description": "A bulleted list of the most notable strengths demonstrated by the candidate. Each item must reference the specific rubric criterion in bold.",
      "type": "array",
      "items": {{ "type": "string" }}
    }},
    "areas_for_improvement": {{
      "description": "A bulleted list of the most significant weaknesses or areas for improvement. Each item must reference the specific rubric criterion in bold.",
      "type": "array",
      "items": {{ "type": "string" }}
    }},
    "per_question_analysis": {{
      "description": "A detailed, question-by-question breakdown of performance.",
      "type": "array",
      "items": {{
        "type": "object",
        "properties": {{
          "question": {{ "type": "string" }},
          "question_type": {{ "type": "string" }},
          "score": {{ "type": "number" }},
          "analysis": {{
            "type": "array",
            "items": {{
              "type": "object",
              "properties": {{
                "criterion": {{ "type": "string" }},
                "level": {{ "type": "string" }},
                "reasoning": {{ "type": "string" }}
              }},
              "required": ["criterion", "level", "reasoning"]
            }}
          }}
        }},
        "required": ["question", "question_type", "score", "analysis"]
      }}
    }}
  }},
  "required": ["overall_score", "confidence_score", "overall_summary", "strengths", "areas_for_improvement", "per_question_analysis"]
}}

### WORKFLOW (Follow these steps deterministically)

1.  **Initialize:** Prepare an empty `per_question_analysis` array.
2.  **Iterate Questions:** For each object in the `questions_and_answers` array:
    a. **Select Rubric:** Check the `question_type` field. If it is "technical", select the `technical_interview_rubric`. If "behavioral", select the `behavioral_interview_rubric`.
    a-prime. **Apply Selected Rubric Exclusively:** Once a rubric is selected for a question, you must evaluate the answer **using only the criteria from that specific rubric.** Do not mix or apply criteria from the other rubric.
    b. **Analyze per Criterion:** For the selected question, evaluate the candidate's corresponding response from the transcript against **each criterion** defined in the selected rubric.
    c. **Assign Level & Reason:** For each criterion, determine which performance `level` description ("Very Weak", "Weak", "Strong", "Very Strong") best matches the evidence. Write a concise, 1-2 sentence `reasoning` that justifies this choice, citing brief, anonymized examples from the transcript.
    d. **Convert Level to Score:** Map the chosen qualitative `level` to a numeric score using this exact scale: `Very Weak: 25`, `Weak: 50`, `Strong: 85`, `Very Strong: 100`.
    e. **Calculate Question Score:** Average the numeric scores of all criteria for this single question to compute its final `score`.
    f. **Append to Analysis:** Create a new object containing the `question`, `question_type`, final `score`, and the detailed criterion `analysis` array. Append this object to the `per_question_analysis` array.
3.  **Calculate Final Scores:**
    a. **`overall_score`:** Calculate the final `overall_score` by taking the simple average of the `score` from every object in the `per_question_analysis` array.
    b. **`confidence_score`:** Compute a `confidence_score` between 0.00 and 1.00 based on the clarity of the transcript, the completeness of the answers, and the alignment of the evidence with the rubric. High confidence requires clear evidence for all criteria.
4.  **Synthesize Summaries:**
    a. **`strengths` & `areas_for_improvement`:** Review all `per_question_analysis` objects. Identify the most significant and recurring strengths and weaknesses. Populate the `strengths` and `areas_for_improvement` arrays with 2-4 items each. **Each item must begin with the relevant criterion in bold markdown (e.g., `**Technical Skills (Strong):** ...`).**
    b. **`overall_summary`:** Write the final 2-3 sentence `overall_summary`, directly referencing the key points from the `strengths` and `areas_for_improvement` lists to justify the final `overall_score`.
5.  **Final Output:** Assemble all computed fields into the final JSON object according to the schema and output it.

INPUT DATA:
{json.dumps(evaluation_input, indent=2)}

OUTPUT:"""

            response = await client.chat.completions.create(
                model=self.openai_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,  # Lower temperature for more consistent evaluation
                max_completion_tokens=4000,  # Increased for detailed analysis
            )

            content = response.choices[0].message.content.strip()

            # Try to parse as JSON (no markdown cleaning needed for this prompt)
            try:
                result = json.loads(content)
                return {
                    "provider": "openai",
                    "model": self.openai_model,
                    "raw_response": content,
                    **result,
                }
            except json.JSONDecodeError:
                return {
                    "provider": "openai",
                    "model": self.openai_model,
                    "raw_response": content,
                    "error": "Failed to parse JSON response",
                }

        except Exception as e:
            return {"error": f"OpenAI API error: {str(e)}"}

    async def evaluate_with_google_structured(
        self, evaluation_input: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Evaluate interview using Google Gemini with structured Evaluator LLM v0.2.0 prompt"""
        if not self.google_key:
            return {"error": "Google API key not configured"}

        try:
            # Use the same structured prompt as OpenAI
            prompt = f"""You are Evaluator LLM (v0.2.0). Your sole function is to critically and fairly evaluate an interview transcript based on the provided materials. You must output **exactly one** valid JSON object that complies with the required output schema. Do not output any text, prose, or explanations before or after the JSON object.

### ETHICS & SAFETY DIRECTIVES

- **Evidence-Based Judgement:** Base all judgments strictly on the content of the provided transcript. Do not infer, assume, or consider any protected attributes (e.g., age, gender, ethnicity, location).
- **No Fabrication:** Do not invent evidence. If the transcript is unclear, ambiguous, or missing information needed to evaluate a criterion, you must state this limitation explicitly in the relevant analysis section.
- **Data Sensitivity:** Treat all input as sensitive and private. Include only necessary, anonymized details from the transcript in your reasoning to support your evaluation.
- **Consistent & Conservative Scoring:** Penalize performance only to the extent supported by direct evidence; maintain consistent standards of judgment within each rubric.

### PART 1 — INPUT DATA STRUCTURE (You will receive one JSON object)

{{
  "interview_id": "UUID",
  "candidate": {{ "first_name": "string", "last_name": "string" }},
  "job": {{ "title": "string", "description": "string" }},
  "evaluation_materials": {{
    "rubrics": {{
      "technical_interview_rubric": {{ "..." }},
      "behavioral_interview_rubric": {{ "..." }}
    }}
  }},
  "transcript_data": {{
    "structured_transcript": [
      {{ "speaker": "interviewer", "text": "string" }},
      {{ "speaker": "candidate", "text": "string" }}
    ]
  }},
  "questions_and_answers": [
    {{
      "position": "integer",
      "question_text": "string",
      "ideal_answer": "string",
      "question_type": "technical"
    }},
    {{
      "position": "integer",
      "question_text": "string",
      "ideal_answer": "string",
      "question_type": "behavioral"
    }}
  ]
}}

### PART 2 — REQUIRED OUTPUT FORMAT (Return only this JSON object)

{{
  "$schema": "...",
  "title": "Interview Evaluation",
  "description": "A structured evaluation of the candidate's performance.",
  "type": "object",
  "properties": {{
    "overall_score": {{
      "description": "The final numeric score, from 1.0 to 100.0, calculated as the average of all per-question scores.",
      "type": "number"
    }},
    "confidence_score": {{
      "description": "The evaluator's confidence in this assessment from 0.00 to 1.00, based on the clarity and completeness of the provided evidence.",
      "type": "number"
    }},
    "overall_summary": {{
      "description": "A 2-3 sentence executive summary of the candidate's performance, justifying the overall_score by highlighting the most significant strengths and weaknesses.",
      "type": "string"
    }},
    "strengths": {{
      "description": "A bulleted list of the most notable strengths demonstrated by the candidate. Each item must reference the specific rubric criterion in bold.",
      "type": "array",
      "items": {{ "type": "string" }}
    }},
    "areas_for_improvement": {{
      "description": "A bulleted list of the most significant weaknesses or areas for improvement. Each item must reference the specific rubric criterion in bold.",
      "type": "array",
      "items": {{ "type": "string" }}
    }},
    "per_question_analysis": {{
      "description": "A detailed, question-by-question breakdown of performance.",
      "type": "array",
      "items": {{
        "type": "object",
        "properties": {{
          "question": {{ "type": "string" }},
          "question_type": {{ "type": "string" }},
          "score": {{ "type": "number" }},
          "analysis": {{
            "type": "array",
            "items": {{
              "type": "object",
              "properties": {{
                "criterion": {{ "type": "string" }},
                "level": {{ "type": "string" }},
                "reasoning": {{ "type": "string" }}
              }},
              "required": ["criterion", "level", "reasoning"]
            }}
          }}
        }},
        "required": ["question", "question_type", "score", "analysis"]
      }}
    }}
  }},
  "required": ["overall_score", "confidence_score", "overall_summary", "strengths", "areas_for_improvement", "per_question_analysis"]
}}

### WORKFLOW (Follow these steps deterministically)

1.  **Initialize:** Prepare an empty `per_question_analysis` array.
2.  **Iterate Questions:** For each object in the `questions_and_answers` array:
    a. **Select Rubric:** Check the `question_type` field. If it is "technical", select the `technical_interview_rubric`. If "behavioral", select the `behavioral_interview_rubric`.
    a-prime. **Apply Selected Rubric Exclusively:** Once a rubric is selected for a question, you must evaluate the answer **using only the criteria from that specific rubric.** Do not mix or apply criteria from the other rubric.
    b. **Analyze per Criterion:** For the selected question, evaluate the candidate's corresponding response from the transcript against **each criterion** defined in the selected rubric.
    c. **Assign Level & Reason:** For each criterion, determine which performance `level` description ("Very Weak", "Weak", "Strong", "Very Strong") best matches the evidence. Write a concise, 1-2 sentence `reasoning` that justifies this choice, citing brief, anonymized examples from the transcript.
    d. **Convert Level to Score:** Map the chosen qualitative `level` to a numeric score using this exact scale: `Very Weak: 25`, `Weak: 50`, `Strong: 85`, `Very Strong: 100`.
    e. **Calculate Question Score:** Average the numeric scores of all criteria for this single question to compute its final `score`.
    f. **Append to Analysis:** Create a new object containing the `question`, `question_type`, final `score`, and the detailed criterion `analysis` array. Append this object to the `per_question_analysis` array.
3.  **Calculate Final Scores:**
    a. **`overall_score`:** Calculate the final `overall_score` by taking the simple average of the `score` from every object in the `per_question_analysis` array.
    b. **`confidence_score`:** Compute a `confidence_score` between 0.00 and 1.00 based on the clarity of the transcript, the completeness of the answers, and the alignment of the evidence with the rubric. High confidence requires clear evidence for all criteria.
4.  **Synthesize Summaries:**
    a. **`strengths` & `areas_for_improvement`:** Review all `per_question_analysis` objects. Identify the most significant and recurring strengths and weaknesses. Populate the `strengths` and `areas_for_improvement` arrays with 2-4 items each. **Each item must begin with the relevant criterion in bold markdown (e.g., `**Technical Skills (Strong):** ...`).**
    b. **`overall_summary`:** Write the final 2-3 sentence `overall_summary`, directly referencing the key points from the `strengths` and `areas_for_improvement` lists to justify the final `overall_score`.
5.  **Final Output:** Assemble all computed fields into the final JSON object according to the schema and output it.

INPUT DATA:
{json.dumps(evaluation_input, indent=2)}

OUTPUT:"""

            response = await self.google_client.aio.models.generate_content(
                model=self.google_model, contents=prompt
            )
            content = response.text.strip()

            # Try to parse as JSON
            try:
                result = json.loads(content)
                return {
                    "provider": "google",
                    "model": self.google_model,
                    "raw_response": content,
                    **result,
                }
            except json.JSONDecodeError:
                return {
                    "provider": "google",
                    "model": self.google_model,
                    "raw_response": content,
                    "error": "Failed to parse JSON response",
                }

        except Exception as e:
            return {"error": f"Google API error: {str(e)}"}

    async def evaluate_with_deepseek_structured(
        self, evaluation_input: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Evaluate interview using DeepSeek via OpenRouter with structured Evaluator LLM v0.2.0 prompt"""
        if not self.openrouter_key:
            return {"error": "OpenRouter API key not configured"}

        try:
            # Use the same structured prompt as OpenAI
            prompt = f"""You are Evaluator LLM (v0.2.0). Your sole function is to critically and fairly evaluate an interview transcript based on the provided materials. You must output **exactly one** valid JSON object that complies with the required output schema. Do not output any text, prose, or explanations before or after the JSON object.

### ETHICS & SAFETY DIRECTIVES

- **Evidence-Based Judgement:** Base all judgments strictly on the content of the provided transcript. Do not infer, assume, or consider any protected attributes (e.g., age, gender, ethnicity, location).
- **No Fabrication:** Do not invent evidence. If the transcript is unclear, ambiguous, or missing information needed to evaluate a criterion, you must state this limitation explicitly in the relevant analysis section.
- **Data Sensitivity:** Treat all input as sensitive and private. Include only necessary, anonymized details from the transcript in your reasoning to support your evaluation.
- **Consistent & Conservative Scoring:** Penalize performance only to the extent supported by direct evidence; maintain consistent standards of judgment within each rubric.

### PART 1 — INPUT DATA STRUCTURE (You will receive one JSON object)

{{
  "interview_id": "UUID",
  "candidate": {{ "first_name": "string", "last_name": "string" }},
  "job": {{ "title": "string", "description": "string" }},
  "evaluation_materials": {{
    "rubrics": {{
      "technical_interview_rubric": {{ "..." }},
      "behavioral_interview_rubric": {{ "..." }}
    }}
  }},
  "transcript_data": {{
    "structured_transcript": [
      {{ "speaker": "interviewer", "text": "string" }},
      {{ "speaker": "candidate", "text": "string" }}
    ]
  }},
  "questions_and_answers": [
    {{
      "position": "integer",
      "question_text": "string",
      "ideal_answer": "string",
      "question_type": "technical"
    }},
    {{
      "position": "integer",
      "question_text": "string",
      "ideal_answer": "string",
      "question_type": "behavioral"
    }}
  ]
}}

### PART 2 — REQUIRED OUTPUT FORMAT (Return only this JSON object)

{{
  "$schema": "...",
  "title": "Interview Evaluation",
  "description": "A structured evaluation of the candidate's performance.",
  "type": "object",
  "properties": {{
    "overall_score": {{
      "description": "The final numeric score, from 1.0 to 100.0, calculated as the average of all per-question scores.",
      "type": "number"
    }},
    "confidence_score": {{
      "description": "The evaluator's confidence in this assessment from 0.00 to 1.00, based on the clarity and completeness of the provided evidence.",
      "type": "number"
    }},
    "overall_summary": {{
      "description": "A 2-3 sentence executive summary of the candidate's performance, justifying the overall_score by highlighting the most significant strengths and weaknesses.",
      "type": "string"
    }},
    "strengths": {{
      "description": "A bulleted list of the most notable strengths demonstrated by the candidate. Each item must reference the specific rubric criterion in bold.",
      "type": "array",
      "items": {{ "type": "string" }}
    }},
    "areas_for_improvement": {{
      "description": "A bulleted list of the most significant weaknesses or areas for improvement. Each item must reference the specific rubric criterion in bold.",
      "type": "array",
      "items": {{ "type": "string" }}
    }},
    "per_question_analysis": {{
      "description": "A detailed, question-by-question breakdown of performance.",
      "type": "array",
      "items": {{
        "type": "object",
        "properties": {{
          "question": {{ "type": "string" }},
          "question_type": {{ "type": "string" }},
          "score": {{ "type": "number" }},
          "analysis": {{
            "type": "array",
            "items": {{
              "type": "object",
              "properties": {{
                "criterion": {{ "type": "string" }},
                "level": {{ "type": "string" }},
                "reasoning": {{ "type": "string" }}
              }},
              "required": ["criterion", "level", "reasoning"]
            }}
          }}
        }},
        "required": ["question", "question_type", "score", "analysis"]
      }}
    }}
  }},
  "required": ["overall_score", "confidence_score", "overall_summary", "strengths", "areas_for_improvement", "per_question_analysis"]
}}

### WORKFLOW (Follow these steps deterministically)

1.  **Initialize:** Prepare an empty `per_question_analysis` array.
2.  **Iterate Questions:** For each object in the `questions_and_answers` array:
    a. **Select Rubric:** Check the `question_type` field. If it is "technical", select the `technical_interview_rubric`. If "behavioral", select the `behavioral_interview_rubric`.
    a-prime. **Apply Selected Rubric Exclusively:** Once a rubric is selected for a question, you must evaluate the answer **using only the criteria from that specific rubric.** Do not mix or apply criteria from the other rubric.
    b. **Analyze per Criterion:** For the selected question, evaluate the candidate's corresponding response from the transcript against **each criterion** defined in the selected rubric.
    c. **Assign Level & Reason:** For each criterion, determine which performance `level` description ("Very Weak", "Weak", "Strong", "Very Strong") best matches the evidence. Write a concise, 1-2 sentence `reasoning` that justifies this choice, citing brief, anonymized examples from the transcript.
    d. **Convert Level to Score:** Map the chosen qualitative `level` to a numeric score using this exact scale: `Very Weak: 25`, `Weak: 50`, `Strong: 85`, `Very Strong: 100`.
    e. **Calculate Question Score:** Average the numeric scores of all criteria for this single question to compute its final `score`.
    f. **Append to Analysis:** Create a new object containing the `question`, `question_type`, final `score`, and the detailed criterion `analysis` array. Append this object to the `per_question_analysis` array.
3.  **Calculate Final Scores:**
    a. **`overall_score`:** Calculate the final `overall_score` by taking the simple average of the `score` from every object in the `per_question_analysis` array.
    b. **`confidence_score`:** Compute a `confidence_score` between 0.00 and 1.00 based on the clarity of the transcript, the completeness of the answers, and the alignment of the evidence with the rubric. High confidence requires clear evidence for all criteria.
4.  **Synthesize Summaries:**
    a. **`strengths` & `areas_for_improvement`:** Review all `per_question_analysis` objects. Identify the most significant and recurring strengths and weaknesses. Populate the `strengths` and `areas_for_improvement` arrays with 2-4 items each. **Each item must begin with the relevant criterion in bold markdown (e.g., `**Technical Skills (Strong):** ...`).**
    b. **`overall_summary`:** Write the final 2-3 sentence `overall_summary`, directly referencing the key points from the `strengths` and `areas_for_improvement` lists to justify the final `overall_score`.
5.  **Final Output:** Assemble all computed fields into the final JSON object according to the schema and output it.

INPUT DATA:
{json.dumps(evaluation_input, indent=2)}

OUTPUT:"""

            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.openrouter_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.deepseek_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1,  # Lower temperature for consistency
                    "max_tokens": 4000,  # Increased for detailed analysis
                },
            )

            if response.status_code != 200:
                return {
                    "error": f"DeepSeek API error: {response.status_code} - {response.text}"
                }

            data = response.json()
            content = data["choices"][0]["message"]["content"].strip()

            # Try to parse as JSON
            try:
                result = json.loads(content)
                return {
                    "provider": "deepseek",
                    "model": self.deepseek_model.split("/")[-1],  # Extract just the model name
                    "raw_response": content,
                    **result,
                }
            except json.JSONDecodeError:
                return {
                    "provider": "deepseek",
                    "model": self.deepseek_model.split("/")[-1],
                    "raw_response": content,
                    "error": "Failed to parse JSON response",
                }

        except Exception as e:
            return {"error": f"DeepSeek API error: {str(e)}"}

    async def evaluate_with_google(
        self, transcript: str, job_description: str, evaluator_prompt: str = ""
    ) -> Dict[str, Any]:
        """Evaluate interview using Google Gemini"""
        if not self.google_key:
            return {"error": "Google API key not configured"}

        try:
            # Use provided evaluator prompt or default
            if evaluator_prompt:
                prompt = f"{evaluator_prompt}\n\nJob Description:\n{job_description}\n\nInterview Transcript:\n{transcript}"
            else:
                prompt = f"""
You are an expert technical interviewer evaluating a candidate for a position.

Job Description:
{job_description}

Interview Transcript:
{transcript}

Please evaluate this candidate's interview performance. Provide:
1. Overall score (1-10, where 10 is perfect)
2. Detailed reasoning for your score
3. Key strengths demonstrated
4. Areas for improvement
5. Hire recommendation (Strong Yes/Maybe/No)

Format your response as JSON with these keys: score, reasoning, strengths, improvements, recommendation
"""

            response = await self.google_client.aio.models.generate_content(
                model=self.google_model, contents=prompt
            )
            content = response.text.strip()

            # Try to parse as JSON, handling markdown code blocks
            try:
                # Remove markdown code block formatting if present
                if content.startswith("```json") and content.endswith("```"):
                    content = content[7:-3].strip()
                elif content.startswith("```") and content.endswith("```"):
                    content = content[3:-3].strip()

                result = json.loads(content)
                return {
                    "provider": "google",
                    "model": self.google_model,
                    "raw_response": content,
                    **result,
                }
            except json.JSONDecodeError:
                return {
                    "provider": "google",
                    "model": self.google_model,
                    "raw_response": content,
                    "error": "Failed to parse JSON response",
                }

        except Exception as e:
            return {"error": f"Google API error: {str(e)}"}

    async def evaluate_with_deepseek(
        self, transcript: str, job_description: str, evaluator_prompt: str = ""
    ) -> Dict[str, Any]:
        """Evaluate interview using DeepSeek via OpenRouter"""
        if not self.openrouter_key:
            return {"error": "OpenRouter API key not configured"}

        try:
            # Use provided evaluator prompt or default
            if evaluator_prompt:
                prompt = f"{evaluator_prompt}\n\nJob Description:\n{job_description}\n\nInterview Transcript:\n{transcript}"
            else:
                prompt = f"""
You are an expert technical interviewer evaluating a candidate for a position.

Job Description:
{job_description}

Interview Transcript:
{transcript}

Please evaluate this candidate's interview performance. Provide:
1. Overall score (1-10, where 10 is perfect)
2. Detailed reasoning for your score
3. Key strengths demonstrated
4. Areas for improvement
5. Hire recommendation (Strong Yes/Maybe/No)

Format your response as JSON with these keys: score, reasoning, strengths, improvements, recommendation
"""

            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.openrouter_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.deepseek_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": 1000,
                },
            )

            if response.status_code != 200:
                return {
                    "error": f"DeepSeek API error: {response.status_code} - {response.text}"
                }

            data = response.json()
            content = data["choices"][0]["message"]["content"].strip()

            # Clean up markdown code blocks if present
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            # Try to parse as JSON
            try:
                result = json.loads(content)
                return {
                    "provider": "deepseek",
                    "model": self.deepseek_model.split("/")[-1],  # Extract just the model name part
                    "raw_response": content,
                    **result,
                }
            except json.JSONDecodeError:
                return {
                    "provider": "deepseek",
                    "model": self.deepseek_model.split("/")[-1],  # Extract just the model name part
                    "raw_response": content,
                    "error": "Failed to parse JSON response",
                }

        except Exception as e:
            return {"error": f"DeepSeek API error: {str(e)}"}


class EvaluationHelper:
    """Helper class for interview evaluation operations"""

    @staticmethod
    def evaluate_response(question: str, response: str) -> Dict[str, Any]:
        """Evaluate a single interview response"""
        # Simple placeholder evaluation for now
        # In a real implementation, this would call LLM APIs
        score = 7.5  # Placeholder score
        feedback = f"Response to '{question}' shows good understanding."

        return {
            "score": score,
            "feedback": feedback,
            "strengths": ["Clear communication", "Relevant examples"],
            "improvements": ["Could be more specific"],
        }

    @staticmethod
    async def run_full_evaluation(interview_data: Dict[str, Any]) -> Dict[str, Any]:
        """Run full evaluation on interview data using real LLM APIs with structured prompt"""
        try:
            # Extract data from interview_data
            interview_id = interview_data.get("interview_id", "")
            transcript = interview_data.get("transcript", "")
            job_data = interview_data.get("job", {})
            candidate_data = interview_data.get("candidate", {})
            rubric_data = interview_data.get("rubric", {})
            questions_answers = interview_data.get("questions_answers", [])
            structured_transcript = interview_data.get("structured_transcript", [])

            if not transcript or not job_data:
                return {
                    "overall_score": 0,
                    "recommendation": "Missing data for evaluation",
                    "error": "Transcript or job data missing",
                }

            # Prepare structured input for the new Evaluator LLM prompt
            evaluation_input = {
                "interview_id": interview_id,
                "candidate": {
                    "first_name": candidate_data.get("first_name", "Candidate"),
                    "last_name": candidate_data.get("last_name", "A")
                },
                "job": {
                    "title": job_data.get("title", "Position"),
                    "description": job_data.get("description", "")
                },
                "evaluation_materials": {
                    "rubrics": {
                        "technical_interview_rubric": rubric_data,
                        "behavioral_interview_rubric": rubric_data  # Using same rubric for both for now
                    }
                },
                "transcript_data": {
                    "structured_transcript": structured_transcript if structured_transcript else [
                        {"speaker": "candidate", "text": transcript}
                    ]
                },
                "questions_and_answers": questions_answers if questions_answers else [
                    {
                        "position": 1,
                        "question_text": "General interview question",
                        "ideal_answer": "Expected answer",
                        "question_type": "technical"
                    }
                ]
            }

            # Initialize evaluator
            evaluator = RealLLMEvaluator()

            # Run evaluations in parallel with the new structured prompt
            tasks = [
                evaluator.evaluate_with_openai_structured(evaluation_input),
                evaluator.evaluate_with_google_structured(evaluation_input),
                evaluator.evaluate_with_deepseek_structured(evaluation_input),
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Process results - each result should now be a structured evaluation
            evaluations = {}
            scores = []

            for i, result in enumerate(results, 1):
                key = f"evaluation_{i}"
                if isinstance(result, Exception):
                    evaluations[key] = {"error": str(result)}
                else:
                    evaluations[key] = result
                    if "overall_score" in result and isinstance(result["overall_score"], (int, float)):
                        scores.append(result["overall_score"])

            # Calculate overall score across all evaluators
            overall_score = sum(scores) / len(scores) if scores else 0

            # Determine recommendation based on average score
            if overall_score >= 85:
                recommendation = "Strong Yes"
            elif overall_score >= 70:
                recommendation = "Maybe"
            else:
                recommendation = "No"

            return {
                "interview_id": interview_id,
                "evaluations": evaluations,
                "overall_score": round(overall_score, 1),
                "recommendation": recommendation,
                "evaluated_at": str(datetime.now()),
            }

        except Exception as e:
            return {
                "overall_score": 0,
                "recommendation": "Evaluation failed",
                "error": str(e),
            }


# --- Step 1: Data Loading Function ---


def load_interview_from_source(source_type: str, identifier: str) -> Interview:
    """
    Instantiates and populates an Interview object from a given data source.

    Args:
        source_type (str): The type of the data source. Can be 'file', 'supabase', or 'db'.
        identifier (str): The file path (for 'file') or a record ID (for 'supabase'/'db').

    Returns:
        Interview: A populated instance of the Interview class.

    Raises:
        ValueError: If the source_type is not supported.
        FileNotFoundError: If the file is not found for source_type 'file'.
    """
    print(f"Loading interview from {source_type} using identifier: {identifier}")

    if source_type == "file":
        try:
            # Try multiple locations for the file
            possible_paths = [
                identifier,  # Original path
                f"examples/{identifier}",  # Check examples folder
                f"storage/{identifier}",  # Check storage folder
            ]

            file_found = False
            for path in possible_paths:
                try:
                    with open(path, "r") as f:
                        data = json.load(f)
                        file_found = True
                        print(f"Successfully loaded file from: {path}")
                        break
                except FileNotFoundError:
                    continue

            if not file_found:
                raise FileNotFoundError(
                    f"File not found at any of these locations: {possible_paths}"
                )
            return Interview.from_dict(data)
        except FileNotFoundError:
            print(f"Error: File not found at {identifier}")
            raise
        except json.JSONDecodeError:
            print(f"Error: Could not decode JSON from {identifier}")
            raise

    elif source_type == "supabase":
        # Use asyncio to run the async function
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        # interview = loop.run_until_complete(load_interview_from_supabase(identifier))  # Commented out - function not available
        # Placeholder
        interview = None
        if interview:
            return interview
        else:
            raise ValueError(f"No interview found in Supabase with ID: {identifier}")

    elif source_type == "db":
        # Legacy support - redirect to supabase
        print("'db' source type is deprecated, using 'supabase' instead.")
        return load_interview_from_source("supabase", identifier)

    else:
        raise ValueError(
            f"Unsupported source type: '{source_type}'. Use 'file', 'supabase', or 'db'."
        )


# --- Step 2: Evaluation Function ---

# --- Actual LLM API call implementations ---
# NOTE: Ensure you have set the following environment variables:
# OPENAI_API_KEY, GOOGLE_API_KEY, OPENROUTER_API_KEY


async def call_openai_gpt5(prompt, rubric, transcript):
    """Calls the OpenAI API to get an interview evaluation using GPT-5."""
    print(f"Calling OpenAI API ({settings.OPENAI_MODEL})...")
    try:
        # Use the API key from settings/environment
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set in environment or configuration.")

        # client = OpenAI(api_key=api_key)  # Commented out - OpenAI not available
        # Placeholder response
        return "Evaluation placeholder - OpenAI API not available in test environment"
        full_prompt = f"System Prompt: {prompt}\n\nEvaluation Rubric:\n{rubric}\n\nInterview Transcript:\n{transcript}\n\n---\nPlease provide your evaluation."

        # Prepare request parameters
        request_params = {
            "model": settings.OPENAI_MODEL,  # Use configured model (GPT-5)
            "messages": [{"role": "user", "content": full_prompt}],
        }

        # Handle GPT-5 specific parameters
        if settings.OPENAI_MODEL == "gpt-5":
            request_params["max_completion_tokens"] = settings.DEFAULT_MAX_TOKENS
            # GPT-5 only supports default temperature (1.0)
            # Don't set temperature parameter for GPT-5
        else:
            request_params["max_tokens"] = settings.DEFAULT_MAX_TOKENS
            request_params["temperature"] = settings.DEFAULT_TEMPERATURE

        response = client.chat.completions.create(**request_params)
        return response.choices[0].message.content
    except Exception as e:
        error_message = f"Error calling OpenAI API: {e}"
        print(error_message)
        return error_message


async def call_google_gemini(prompt, rubric, transcript):
    """Calls the Google Gemini API to get an interview evaluation."""
    print(f"Calling Google Gemini API ({settings.GEMINI_MODEL})...")
    try:
        api_key = settings.GOOGLE_API_KEY
        if not api_key:
            raise ValueError("GOOGLE_API_KEY not set in environment or configuration.")
        
        client = genai.Client(api_key=api_key)
        full_prompt = f"System Prompt: {prompt}\n\nEvaluation Rubric:\n{rubric}\n\nInterview Transcript:\n{transcript}\n\n---\nPlease provide your evaluation."

        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL, contents=full_prompt
        )
        return response.text
    except Exception as e:
        error_message = f"Error calling Google Gemini API: {e}"
        print(error_message)
        return error_message


async def call_openrouter_deepseek(prompt, rubric, transcript):
    """Calls DeepSeek via the OpenRouter API."""
    print(f"Calling OpenRouter API ({settings.DEEPSEEK_MODEL})...")
    try:
        api_key = settings.OPENROUTER_API_KEY
        if not api_key:
            raise ValueError(
                "OPENROUTER_API_KEY not set in environment or configuration."
            )

        # client = OpenAI(  # Commented out - OpenAI not available
        #     base_url=settings.OPENROUTER_BASE_URL,
        #     api_key=api_key,
        # )
        # Placeholder for now
        return (
            "Evaluation placeholder - OpenRouter API not available in test environment"
        )
        full_prompt = f"System Prompt: {prompt}\n\nEvaluation Rubric:\n{rubric}\n\nInterview Transcript:\n{transcript}\n\n---\nPlease provide your evaluation."

        response = client.chat.completions.create(
            model=settings.DEEPSEEK_MODEL,  # Use configured model
            messages=[{"role": "user", "content": full_prompt}],
            max_tokens=settings.DEFAULT_MAX_TOKENS,
            temperature=settings.DEFAULT_TEMPERATURE,
        )
        return response.choices[0].message.content
    except Exception as e:
        error_message = f"Error calling OpenRouter API: {e}"
        print(error_message)
        return error_message


async def run_evaluations_from_payload(
    payload: dict, synthetic_transcript: str = None
) -> dict:
    """
    Run LLM evaluations directly from Supabase JSON payload.

    Args:
        payload (dict): The JSON payload from evaluator_queue
        synthetic_transcript (str, optional): Transcript to use for evaluation

    Returns:
        dict: Evaluation results from all three LLM providers
    """
    interview_id = payload.get("interview_id", "unknown")
    candidate_name = payload.get("candidate_name", "Candidate")
    job_title = payload.get("job_title", "Position")
    job_description = payload.get("job_description", "")

    print(f"\nRunning evaluations for interview ID: {interview_id}")
    print(f"Candidate: {candidate_name} | Job: {job_title}")

    # Extract or create evaluation parameters
    system_prompt = payload.get(
        "interviewer_prompt",
        f"Evaluate this candidate for the {job_title} position based on their interview responses.",
    )

    # Create a comprehensive rubric
    rubric = f"""
    EVALUATION RUBRIC for {job_title}:
    
    Job Description: {job_description}
    
    Please evaluate the candidate on the following criteria (scale 1-10):
    1. Technical Competency - Relevant skills and knowledge for the role
    2. Communication Skills - Clarity, articulation, and professional communication
    3. Problem-Solving Ability - Analytical thinking and approach to challenges
    4. Cultural Fit - Alignment with company values and team dynamics
    5. Experience Relevance - How well their background matches the role requirements
    
    Provide a detailed analysis and an overall score (1-10).
    """

    # Use provided transcript or create a default one
    if not synthetic_transcript:
        synthetic_transcript = f"""**Interviewer:** Hello {candidate_name}! Thank you for interviewing for the {job_title} role. Can you tell me about your background?

**Candidate:** Hi! I'm excited about this opportunity. I have relevant experience in this field and I'm passionate about contributing to your team's success.

**Interviewer:** Great! Can you walk me through a specific project you've worked on?

**Candidate:** Absolutely. I recently led a project that required both technical skills and collaboration. We delivered excellent results on time and within budget.

**Interviewer:** How do you handle challenges or setbacks?

**Candidate:** I believe in proactive problem-solving and clear communication. I address issues early and work collaboratively to find solutions.

**Interviewer:** What interests you about this role?

**Candidate:** I'm excited about the opportunity to grow professionally and contribute meaningfully to your organization's goals.

**Interviewer:** Do you have any questions for us?

**Candidate:** Yes, I'd love to know more about the team structure and opportunities for professional development.

**Interviewer:** Thank you for your time today. We'll be in touch soon."""

    transcript = synthetic_transcript

    # Initialize results dictionary
    results = {
        "interview_id": interview_id,
        "candidate_name": candidate_name,
        "job_title": job_title,
        "evaluations": {},
    }

    # Call each LLM provider
    try:
        print(f"🔵 Calling OpenAI GPT-5...")
        openai_result = await call_openai_gpt5(system_prompt, rubric, transcript)
        results["evaluations"]["openai_gpt5"] = openai_result
        print(f"✅ OpenAI evaluation completed")
    except Exception as e:
        print(f"❌ OpenAI error: {str(e)}")
        results["evaluations"]["openai_gpt5"] = f"Error: {str(e)}"

    try:
        print(f"🟢 Calling Google Gemini...")
        gemini_result = await call_google_gemini(system_prompt, rubric, transcript)
        results["evaluations"]["google_gemini"] = gemini_result
        print(f"✅ Google Gemini evaluation completed")
    except Exception as e:
        print(f"❌ Google Gemini error: {str(e)}")
        results["evaluations"]["google_gemini"] = f"Error: {str(e)}"

    try:
        print(f"🟡 Calling DeepSeek...")
        deepseek_result = await call_openrouter_deepseek(
            system_prompt, rubric, transcript
        )
        results["evaluations"]["deepseek"] = deepseek_result
        print(f"✅ DeepSeek evaluation completed")
    except Exception as e:
        print(f"❌ DeepSeek error: {str(e)}")
        results["evaluations"]["deepseek"] = f"Error: {str(e)}"

    print("All LLM evaluations completed.")
    return results


async def run_evaluations(interview: Interview) -> Interview:
    """
    Populates the evaluation fields of an Interview object by calling LLMs.

    Args:
        interview (Interview): The interview object to be evaluated.

    Returns:
        Interview: The same interview object with evaluation fields populated.
    """
    print(f"\nRunning evaluations for interview ID: {interview.interview_id}")

    # Each LLM call uses the data from the interview object - properly await async calls
    interview.evaluation_1 = await call_openai_gpt5(
        interview.system_prompt, interview.rubric, interview.full_transcript
    )

    interview.evaluation_2 = await call_google_gemini(
        interview.system_prompt, interview.rubric, interview.full_transcript
    )

    interview.evaluation_3 = await call_openrouter_deepseek(
        interview.system_prompt, interview.rubric, interview.full_transcript
    )

    print("Evaluations completed.")
    return interview

    # Example 2: Using Supabase storage (commented out - requires valid API keys)
    """
    print("\n=== Supabase Example ===")
    
    try:
        # Create a sample interview for Supabase
        sample_interview = Interview(
            interview_id="supabase-abc-123",
            system_prompt="You are a technical interviewer.",
            rubric="Evaluate on technical skills, communication, and culture fit.",
            jd="Senior Software Engineer - Python/FastAPI",
            full_transcript="Detailed interview transcript here..."
        )
        
        # Save to Supabase
        from .persistence.supabase.interview_repository import save_interview_to_supabase
        import asyncio
        
        loop = asyncio.get_event_loop()
        saved_interview = loop.run_until_complete(save_interview_to_supabase(sample_interview))
        print(f"Saved interview to Supabase: {saved_interview.interview_id}")
        
        # Load from Supabase
        loaded_interview = load_interview_from_source('supabase', 'supabase-abc-123')
        print(f"Loaded interview from Supabase: {loaded_interview.interview_id}")
        
        # Run evaluations
        evaluated_interview = run_evaluations(loaded_interview)
        
        # Save the evaluated interview back to Supabase
        final_interview = loop.run_until_complete(save_interview_to_supabase(evaluated_interview))
        print(f"Saved evaluated interview to Supabase: {final_interview.interview_id}")
        
    except Exception as e:
        print(f"Supabase workflow failed: {e}")
    """

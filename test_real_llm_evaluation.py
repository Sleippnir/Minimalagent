"""
Test script to create a mock interview and evaluate it with real LLM APIs
Shows actual responses from OpenAI, Google Ge                return {
                    "provider": "google",
                    "model": "gemini-2.5-flash",
                    "raw_response": content,
                    **result
                }and DeepSeek
"""

import asyncio
import json
import uuid
from typing import Dict, Any
import openai
import google.generativeai as genai
import requests
from interview.config import InterviewConfig


class RealLLMEvaluator:
    """Real LLM evaluation using actual APIs"""

    def __init__(self):
        config = InterviewConfig()
        self.openai_key = config.OPENAI_API_KEY
        self.google_key = config.GOOGLE_API_KEY
        self.deepseek_key = config.DEEPSEEK_API_KEY
        self.openrouter_key = config.OPENROUTER_API_KEY

        # Initialize clients
        if self.google_key:
            genai.configure(api_key=self.google_key)

    async def evaluate_with_openai(self, transcript: str, job_description: str) -> Dict[str, Any]:
        """Evaluate interview using OpenAI GPT-4"""
        if not self.openai_key:
            return {"error": "OpenAI API key not configured"}

        try:
            client = openai.AsyncOpenAI(api_key=self.openai_key)

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
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_completion_tokens=1000
            )

            content = response.choices[0].message.content.strip()

            # Clean up markdown code blocks if present
            if content.startswith('```json'):
                content = content[7:]
            if content.endswith('```'):
                content = content[:-3]
            content = content.strip()

            # Try to parse as JSON
            try:
                result = json.loads(content)
                return {
                    "provider": "openai",
                    "model": "gpt-4o",
                    "raw_response": content,
                    **result
                }
            except json.JSONDecodeError:
                return {
                    "provider": "openai",
                    "model": "gpt-4o",
                    "raw_response": content,
                    "error": "Failed to parse JSON response"
                }

        except Exception as e:
            return {"error": f"OpenAI API error: {str(e)}"}

    async def evaluate_with_google(self, transcript: str, job_description: str) -> Dict[str, Any]:
        """Evaluate interview using Google Gemini"""
        if not self.google_key:
            return {"error": "Google API key not configured"}

        try:
            model = genai.GenerativeModel('gemini-2.5-flash')

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

            response = await model.generate_content_async(prompt)
            content = response.text.strip()

            # Try to parse as JSON, handling markdown code blocks
            try:
                # Remove markdown code block formatting if present
                if content.startswith('```json') and content.endswith('```'):
                    content = content[7:-3].strip()
                elif content.startswith('```') and content.endswith('```'):
                    content = content[3:-3].strip()
                
                result = json.loads(content)
                return {
                    "provider": "google",
                    "model": "gemini-2.5-flash",
                    "raw_response": content,
                    **result
                }
            except json.JSONDecodeError:
                return {
                    "provider": "google",
                    "model": "gemini-2.5-flash",
                    "raw_response": content,
                    "error": "Failed to parse JSON response"
                }

        except Exception as e:
            return {"error": f"Google API error: {str(e)}"}

    async def evaluate_with_deepseek(self, transcript: str, job_description: str) -> Dict[str, Any]:
        """Evaluate interview using DeepSeek via OpenRouter"""
        if not self.openrouter_key:
            return {"error": "OpenRouter API key not configured"}

        try:
            url = "https://openrouter.ai/api/v1/chat/completions"

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

            headers = {
                "Authorization": f"Bearer {self.openrouter_key}",
                "Content-Type": "application/json"
            }

            data = {
                "model": "deepseek/deepseek-chat",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 1000
            }

            response = requests.post(url, headers=headers, json=data)
            response.raise_for_status()

            result = response.json()
            content = result["choices"][0]["message"]["content"].strip()

            # Clean up markdown code blocks if present
            if content.startswith('```json'):
                content = content[7:]
            if content.endswith('```'):
                content = content[:-3]
            content = content.strip()

            # Try to parse as JSON
            try:
                parsed_result = json.loads(content)
                return {
                    "provider": "openrouter",
                    "model": "deepseek-chat",
                    "raw_response": content,
                    **parsed_result
                }
            except json.JSONDecodeError:
                return {
                    "provider": "openrouter",
                    "model": "deepseek-chat",
                    "raw_response": content,
                    "error": "Failed to parse JSON response"
                }

        except Exception as e:
            return {"error": f"OpenRouter API error: {str(e)}"}


async def test_real_llm_evaluation():
    """Test real LLM evaluation with a mock interview"""

    print("🧠 Testing Real LLM Evaluation")
    print("=" * 60)

    # Create mock interview data
    job_description = """
## DevOps Engineer Position

We are looking for a DevOps Engineer to help us build and maintain our cloud infrastructure, automate our deployment pipelines, and ensure our systems are reliable and scalable.

### Responsibilities
- Design, build, and maintain CI/CD pipelines
- Manage cloud infrastructure on AWS using Infrastructure as Code (Terraform)
- Implement monitoring, logging, and alerting systems
- Ensure security, reliability, and scalability of production environment
- Work with development teams to troubleshoot issues

### Qualifications
- 4+ years experience in DevOps/SRE role
- Strong AWS experience
- Proficiency with Terraform/CloudFormation
- Experience with Kubernetes/ECS
- Strong scripting skills (Bash, Python)
- Experience with CI/CD tools (Jenkins, GitLab CI, CircleCI)
"""

    # Create mock transcript
    transcript = """
Interviewer: What is containerization (e.g., Docker)?
Candidate: Containerization is a technology that allows you to package applications and their dependencies into lightweight, portable containers. Docker is the most popular platform for this. I've used Docker extensively in my previous roles to create consistent development environments and simplify deployment processes.

Interviewer: Describe a typical CI/CD pipeline.
Candidate: A typical CI/CD pipeline includes several stages: source code management, building the application, running automated tests, security scanning, and deployment to staging and production environments. I've implemented pipelines using Jenkins and GitLab CI that automate these processes, reducing deployment time from hours to minutes.

Interviewer: What is Infrastructure as Code (e.g., Terraform)?
Candidate: Infrastructure as Code is the practice of managing and provisioning infrastructure through machine-readable files rather than physical hardware configuration. Terraform is a popular tool for this. I've used Terraform to manage AWS infrastructure, creating reusable modules for EC2 instances, VPCs, and security groups.

Interviewer: Tell me about a time you failed or made a significant mistake at work.
Candidate: In one project, I underestimated the complexity of migrating a monolithic application to microservices. The migration took longer than planned and caused some downtime. I learned the importance of thorough planning and phased rollouts. Now I always create detailed migration plans and implement feature flags for safer deployments.

Interviewer: Give an example of a goal you set and how you achieved it.
Candidate: I set a goal to reduce deployment time by 50% within 6 months. I achieved this by implementing a comprehensive CI/CD pipeline with automated testing, blue-green deployments, and infrastructure as code. The result was deployments going from 2 hours to 30 minutes, significantly improving our release velocity.

Interviewer: Describe a time you had to give difficult feedback to a colleague.
Candidate: I had to give feedback to a team member whose code quality was impacting the team's velocity. I approached it constructively by focusing on specific examples and offering solutions. I suggested pair programming sessions and code review best practices. The colleague improved significantly and thanked me for the honest feedback.
"""

    print("📝 Mock Interview Created")
    print(f"💼 Job: DevOps Engineer")
    print(f"📄 Transcript: {len(transcript)} characters")
    print()

    # Initialize evaluator
    evaluator = RealLLMEvaluator()

    # Test each LLM
    evaluations = []

    print("🤖 Evaluating with OpenAI GPT-4...")
    openai_result = await evaluator.evaluate_with_openai(transcript, job_description)
    evaluations.append(("OpenAI GPT-4", openai_result))
    print("✅ OpenAI evaluation complete")
    print()

    print("🤖 Evaluating with Google Gemini...")
    google_result = await evaluator.evaluate_with_google(transcript, job_description)
    evaluations.append(("Google Gemini", google_result))
    print("✅ Google evaluation complete")
    print()

    print("🤖 Evaluating with DeepSeek...")
    deepseek_result = await evaluator.evaluate_with_deepseek(transcript, job_description)
    evaluations.append(("DeepSeek", deepseek_result))
    print("✅ DeepSeek evaluation complete")
    print()

    # Display results
    print("📊 EVALUATION RESULTS")
    print("=" * 60)

    for provider, result in evaluations:
        print(f"\n🔍 {provider}")
        print("-" * 40)

        if "error" in result:
            print(f"❌ Error: {result['error']}")
        else:
            print(f"📊 Score: {result.get('score', 'N/A')}/10")
            print(f"💬 Recommendation: {result.get('recommendation', 'N/A')}")
            print(f"🧠 Reasoning: {result.get('reasoning', 'N/A')[:200]}...")

            if result.get('strengths'):
                print(f"💪 Strengths: {', '.join(result['strengths'][:3])}")

            if result.get('improvements'):
                print(f"📈 Improvements: {', '.join(result['improvements'][:2])}")

        print(f"\n📄 Raw Response Preview: {result.get('raw_response', 'N/A')[:300]}...")

    print("\n" + "=" * 60)
    print("🎉 Real LLM Evaluation Test Complete!")


if __name__ == "__main__":
    asyncio.run(test_real_llm_evaluation())
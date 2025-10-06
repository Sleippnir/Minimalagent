#!/usr/bin/env python3
import asyncio
from interview.context_service.services import QueueService
import os
from dotenv import load_dotenv
load_dotenv()

async def check_prompt():
    qs = QueueService()
    context = await qs.get_interview_context_from_queue('de1379c6-054b-406c-a0b7-a799d26c3473')
    if context and 'payload' in context:
        prompt = context['payload'].get('interviewer_prompt', '')
        print('Searching for name references in prompt...')
        if 'name' in prompt.lower():
            lines = prompt.split('\n')
            for i, line in enumerate(lines):
                if 'name' in line.lower():
                    print(f'Line {i+1}: {line.strip()}')
        else:
            print('No "name" references found in prompt')

if __name__ == "__main__":
    asyncio.run(check_prompt())
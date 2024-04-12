# Large Language Model

This folder was intended to contain files related to running the LLM. I've explored hosting an LLM on AWS, using SageMaker, and even got a simple proof of concept to work. However, while this is possible, it's not very cost-effective. Generally, this would require running a server to host the LLM, which would already incur hourly costs. On top of that, I would need to set up an API, like a Lambda, to interact with the LLM.

I opted to use an external service for hosting the LLM, at least on AWS where I obviously can't use my local LLM server. Currently, I'm using OpenRouter. While it still costs money (for the LLM service itself and the outbound traffic on AWS), it's cheaper than self-hosting, although obviously less cool. I prefer my hobby projects not to cost hundreds of dollars.

Technically, the `deploy.py` file in this folder could be used to deploy an LLM to AWS SageMaker. It uses Silicon Maid, an uncensored 7B model. This model seems to strike a good balance between allowing cruder jokes without resorting to, let's say, *unsavory behavior* towards the user.
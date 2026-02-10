## How it works 
In order to Make a Release I had to hardocde my secrets into the build file which is hidden. This is bad as this could be reversed if I released this build. Not that 
the API keys are that important considering they can be got from a free account and are designed to get data and they have rate limiting etc.

The issue is this isn't proffessional. I tried every way I could to try to read them from .env (which tbf isn't that proffesional either). But at least it follows good principle.

No matter what I did I could not read this file from the build level on dev. In the future I would use a secrets manager and hopefully that would be injected better in the future. But for this project no. Sadge.
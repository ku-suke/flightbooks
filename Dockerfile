FROM node:20-slim

RUN apt-get update && apt-get install -y \
    curl \
    git \
    unzip \
    wget \
    fontconfig \
    && wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get install -y ./google-chrome-stable_current_amd64.deb \
    && rm -rf /var/lib/apt/lists/*

ADD template/*.ttf /usr/share/fonts/ 
RUN fc-cache -fv

WORKDIR /app
#!/bin/bash

# ------------------------------------------------------------------------------
# ADD ENCRYPTED DEPLOY KEY FOR THE PREDIX-UI GITHUB ORG
#
# Generates a new public/private deploy keypair, adds the public key to the Github
# repo to authorize pushes, and encrypts the private key in Travis to be
# decrypted during each future run and used to authorize a SSH push.
#
# Also encrypts Sauce Labs credentials in Travis to allow automated frontend
# testing to run.
#
# How to use it:
# Download `deploy.sh` into your project folder. Set the right permissions on
# the file then pass in your Github username and password for authentication:
#
# ```
# chmod 755 deploy.sh
# ./deploy.sh -u GITHUB_USERNAME -p GITHUB_PASSWORD -s SAUCE_USERNAME -k SAUCE_KEY
# ```
# ------------------------------------------------------------------------------

while getopts ":u:p:s:k:" opt; do
  case "$opt" in
  #find username
  u)
    user="$OPTARG"
  ;;
  #find password
  p)
    password="$OPTARG"
  ;;
  # ? means invalid flag was passed.
  \?)
    echo "Invalid option: ${bold}-$OPTARG${normal}" >&2
    exit 1
  ;;
  :)
    echo "the -$OPTARG option requires an argument."
    exit 1
  ;;
  esac
done

# ------------------------------------------------------------------------------
# CLEAR OLD DEPLOY KEYS, GENERATE NEW KEY AND ENCRYPT INTO TRAVIS
# ------------------------------------------------------------------------------

# Remove existing id_rsa.enc or deploy.enc, if any
# If key doesn't exist, will skip and continue without erroring out
rm -f id_rsa
rm -f id_rsa.pub
rm -f id_rsa.enc
rm -f deploy.enc
rm -f deploy1.enc
rm -f deploy2.enc

# Create temp dir for credentials
mkdir -p ~/ghpTemp

# Generate the ssh key silently into ~/ghpTemp/id_rsa
yes | ssh-keygen -N '' -f ~/ghpTemp/id_rsa -t rsa -q

# ... and copy it to root
yes | cp ~/ghpTemp/id_rsa id_rsa
yes | cp ~/ghpTemp/id_rsa.pub id_rsa.pub

# Find the repo name, from the bower.json file
REPO_NAME=$(grep "name" bower.json | sed 's/"name": "//' | sed 's/",//')

# Create a random password
PASSWORD=$(openssl rand -base64 24)
# ... and encrypt pass and add it to travis.yml
travis encrypt DEPLOYSECRET=$PASSWORD --add
# ... and encrypt private ssh key with above password.
openssl aes-256-cbc -k "$PASSWORD" -in id_rsa -out deploy.enc

# Import the public key
public_key=$(<id_rsa.pub)

# Set the URL to query the Github API and add the deploy key to the repo
predixui_url="https://${user}:${password}@api.github.com/repos/predix-ui/${REPO_NAME}/keys"

# And hit github for the update
predixui_status=($(curl -H "Content-Type: application/json" -X POST -d "{\"title\": \"Travis CI Deploy 2\", \"key\": \"${public_key}\" }"  ${predixui_url//[[:space:]]/}))

# Clean up temporary files
rm -f id_rsa
rm -f id_rsa.pub
rm -rf ~/ghpTemp

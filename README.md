# HPCI Shared Storage App

This software is a web application that runs on Open OnDemand server.
It allows users to mount and unmount HPCI Shared Storage.
The Open OnDemand server requires the HPCI shared storage client to be installed in advance.

## Installation

1. Install this app and its dependencies in the Open OnDemand application directory:
   ```bash
   $ cd /var/www/ood/apps/sys/
   $ sudo git clone https://github.com/RIKEN-RCCS/HPCI_Shared_Storage
   $ cd HPCI_Shared_Storage
   $ sudo npm install
   ```

2. (Optional) Verify the full paths of `jwt-agent`, `mount_hpci`, and `umount_hpci` in `./config.yml`:
   ```yaml
   jwt_agent: /usr/local/bin/jwt-agent
   mount_hpci: /usr/local/bin/mount.hpci
   umount_hpci: /usr/local/bin/umount.hpci
   ```

3. (Optional) Edit `./manifest.yml` to suit your environment.

## Usage

1. From the Open OnDemand dashboard, click the **HPCI Shared Storage** icon.
2. Generate a refresh token from [https://elpis.hpci.nii.ac.jp](https://elpis.hpci.nii.ac.jp) and enter your HPCI ID and passphrase.
3. Click the **Mount** button to access HPCI Shared Storage from the **Home Directory** application in Open OnDemand.

## Restrictions

HPCI Shared Storage is mounted from the Open OnDemand server.  
Therefore, if you want to use HPCI Shared Storage in a shell, you will need to log in to the Open OnDemand server via SSH.  
Whether SSH login to the Open OnDemand server is permitted depends on your environment.

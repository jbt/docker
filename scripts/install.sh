#!/usr/bin/env bash

if [ -z "$(which pygmentize)" ]
then
  echo "Looks like you don't have Pygments installed."

  if [ -z "$(which easy_install)" ]
  then
    echo "Looks like you don't have easy_install either."
    echo "Check out http://pypi.python.org/pypi/setuptools to install easy_install, then run:"
    echo "  sudo easy_install Pygments"
    echo "to install pygments"
  else
    echo "You need to run:"
    echo "  sudo easy_install Pygments"
    echo "to install Pygments in order for docker to work"
  fi
fi

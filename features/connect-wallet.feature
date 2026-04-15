Feature: Connect wallet to TradeGenius Asset
  As a crypto trader visiting the TradeGenius Asset platform
  I want to sign in with my MetaMask wallet
  So that the platform can read my address and issue a session for me

  Background:
    Given the user is on the TradeGenius Asset page

  @smoke @wallet:default @revokePermissions
  Scenario: Sign in with MetaMask on the Ethereum network
    When the user opens the wallet sign-in flow
    And the user selects MetaMask on the Ethereum network
    And the user approves the connection request in MetaMask
    And the user signs the login message in MetaMask
    Then the user is signed in with a wallet session

  @regression @wallet:default @revokePermissions
  Scenario: User cancels the MetaMask connection popup
    When the user opens the wallet sign-in flow
    And the user selects MetaMask on the Ethereum network
    And the user rejects the connection request in MetaMask
    Then the user is not signed in

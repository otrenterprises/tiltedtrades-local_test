/**
 * useBalance Hooks
 *
 * React Query hooks for balance data fetching and mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { balanceService } from '@/services/api/balance.service'
import {
  CreateBalanceEntryRequest,
  UpdateBalanceEntryRequest,
  CreateTemplateRequest,
  UpdateTemplateRequest,
} from '@/types/api/balance.types'

/**
 * Hook to fetch all balance data (entries, templates, running balance)
 */
export const useBalance = () => {
  return useQuery({
    queryKey: ['balance'],
    queryFn: () => balanceService.getBalance(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Hook to fetch recurring fee templates only
 */
export const useBalanceTemplates = () => {
  return useQuery({
    queryKey: ['balance', 'templates'],
    queryFn: () => balanceService.getTemplates(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

/**
 * Hook to create a new balance entry
 */
export const useCreateBalanceEntry = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateBalanceEntryRequest) => balanceService.createEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balance'] })
    },
  })
}

/**
 * Hook to update an existing balance entry
 */
export const useUpdateBalanceEntry = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ entryId, data }: { entryId: string; data: UpdateBalanceEntryRequest }) =>
      balanceService.updateEntry(entryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balance'] })
    },
  })
}

/**
 * Hook to delete a balance entry
 */
export const useDeleteBalanceEntry = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (entryId: string) => balanceService.deleteEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balance'] })
    },
  })
}

/**
 * Hook to create a new recurring fee template
 */
export const useCreateBalanceTemplate = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateTemplateRequest) => balanceService.createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balance'] })
    },
  })
}

/**
 * Hook to update an existing recurring fee template
 */
export const useUpdateBalanceTemplate = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: UpdateTemplateRequest }) =>
      balanceService.updateTemplate(templateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balance'] })
    },
  })
}

/**
 * Hook to delete a recurring fee template
 */
export const useDeleteBalanceTemplate = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (templateId: string) => balanceService.deleteTemplate(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balance'] })
    },
  })
}

/**
 * Hook to invalidate all balance queries
 */
export const useInvalidateBalance = () => {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['balance'] })
    },
  }
}
